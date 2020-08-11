const crypto = require('crypto');
// const request = require('request');
const { get, post } = require('request');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');
const accessTokens = require('./../controllers/accessTokenController');
const refreshTokens = require('./../controllers/refreshTokenController');
// import { get, post } from 'request';

const [getAsync, postAsync] = [get, post].map(promisify);

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  res.cookie('jwt_dn', token, {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  });

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

const sendTokenCookie = (user, req, res) => {
  const token = signToken(user._id);

  res.cookie('jwt_dn', token, {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) If everything ok, send token to client
  createSendToken(user, 200, req, res);
});

exports.logout = async (req, res) => {
  res.cookie('jwt_dn', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  const rootUrl = `${req.protocol}://${req.get('host')}`;
  res.redirect(`${process.env.SSO_URL}api/v1/users/logout?redirect_uri=${rootUrl}`);

  // res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt_dn) {
    token = req.cookies.jwt_dn;
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token does no longer exist.', 401));
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('User recently changed password! Please log in again.', 401));
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser; //alias for req.session.user
  res.locals.user = currentUser; // variables that used in the view while rendering (eg.pug)
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  console.log('** isLoggedIn');
  if (req.cookies.jwt_dn) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(req.cookies.jwt_dn, process.env.JWT_SECRET);
      console.log(decoded);

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      console.log(currentUser);
      if (!currentUser) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      console.log('isLoggedIn: user not logined');
      return next();
    }
  }
  next();
};

exports.ensureSingleSignOn = async (req, res, next) => {
  console.log('** ensureSingleSignOn');
  // req.session.redirectURL = req.originalUrl -> triggers loop after redirect
  // req.session.redirectURL = req.originalUrl || req.url; -> triggers loop after redirect
  req.session.redirectURL = '/';
  res.redirect(
    `${process.env.SSO_AUTHORIZE_URL}?redirect_uri=${
      process.env.SSO_REDIRECT_URL
    }&response_type=code&client_id=${process.env.CLIENT_ID}&scope=offline_access`
  );
};

/**
 * https://localhost:5000/receivetoken?code=(authorization code)
 *
 * This is part of the single sign on using the OAuth2 Authorization Code grant type.  This is the
 * redirect from the authorization server.  If you send in a bad authorization code you will get the
 * response code of 400 and the message of
 * {
 *     "error": "invalid_grant",
 *     "error_description": "invalid code"
 * }
 * @param   {Object} req - The request which should have the parameter query of
 *                         ?code=(authorization code)
 * @param   {Object} res - We use this to redirect to the original URL that needed to
 *                         authenticate with the authorization server.
 * @returns {undefined}
 */

exports.ssoReceiveToken = async (req, res, next) => {
  // Get the token
  console.log('**ssoReceiveToken');
  try {
    const { statusCode, body } = await postAsync(process.env.SSO_TOKEN_URL, {
      form: {
        code: req.query.code,
        redirect_uri: process.env.SSO_REDIRECT_URL,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code'
      }
    });
    const msg = JSON.parse(body);
    console.log('msg', msg);
    console.log('statusCode', statusCode);
    const accessToken = msg.access_token;
    const refreshToken = msg.refresh_token;
    const expiresIn = msg.expires_in;

    if (statusCode === 200 && accessToken != null) {
      req.session.accessToken = accessToken;
      req.session.refreshToken = refreshToken;
      const expirationDate = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

      const userInfoObj = await getAsync({
        url: process.env.SSO_USER_INFO_URL,
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        rejectUnauthorized: false
      });
      const currentUser = JSON.parse(userInfoObj.body);
      const userStatusCode = userInfoObj.statusCode;
      console.log('currentUser', currentUser);
      console.log('userStatusCode', userStatusCode);
      const userId = currentUser._id;
      const scope = currentUser.scope;
      const email = currentUser.email;

      if (userStatusCode === 200 && userId) {
        try {
          const filter = { email: email };
          const update = { $set: { name: currentUser.name, email: email, scope: scope } };
          const options = { upsert: true, new: true, setDefaultsOnInsert: true };
          const updatedUser = await User.findOneAndUpdate(filter, update, options);
          console.log('updatedUser', updatedUser);
          res.locals.user = updatedUser;
          sendTokenCookie(updatedUser, req, res);

          await accessTokens.save(
            accessToken,
            expirationDate,
            userId,
            process.env.CLIENT_ID,
            scope
          );
          if (refreshToken != null) {
            await refreshTokens.save(refreshToken, userId, process.env.CLIENT_ID, scope);
          }
          res.redirect(req.session.redirectURL);
        } catch (err) {
          res.sendStatus(500);
        }
      } else {
        res.status(userStatusCode);
        res.send(userInfoObj.body);
      }
    } else {
      // Error, someone is trying to put a bad authorization code in
      res.status(statusCode);
      res.send(body);
    }
  } catch (e) {
    return next(new AppError('Login Failed', 403));
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('There was an error sending the email. Try again later!'), 500);
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});
