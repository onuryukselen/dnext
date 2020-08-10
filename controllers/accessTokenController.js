const AccessToken = require('../models/accessTokenModel');

exports.find = async token => {
  return await AccessToken.findOne({ token: token }, function(err, item) {
    console.log('accesstoken find err1:', err);
    console.log('accesstoken find item1:', item);
    if (err) {
      return err;
    }
    return item;
  });
};

exports.save = async (token, expirationDate, userId, clientId, scope) => {
  try {
    const newToken = new AccessToken({
      token: token,
      expirationDate: expirationDate,
      userId: userId,
      clientId: clientId,
      scope: scope
    });
    const saveToken = await newToken.save();
    console.log('**** AccessToken saved:', token);
    return saveToken;
  } catch (err) {
    return err;
  }
};

exports.delete = async token => {
  return await AccessToken.findOneAndRemove({ token: token }, function(err, item) {
    console.log('AccessToken removed', item, err);
    if (err) {
      return err;
    }
    return item;
  });
};

// Removes expired access tokens.
exports.removeExpired = async function(done) {
  try {
    await AccessToken.find({ expirationDate: { $lt: Date.now() } }, async function(err, item) {
      if (item) {
        await AccessToken.find({ expirationDate: { $lt: Date.now() } }).deleteMany(function(err2) {
          return done(err2);
        });
      }
    });
  } catch (err) {
    done(err);
  }
  return done(null);
};

// exports.forgotPassword = catchAsync(async (req, res, next) => {
//   // 1) Get user based on POSTed email
//   const user = await User.findOne({ email: req.body.email });
//   if (!user) {
//     return next(new AppError('There is no user with email address.', 404));
//   }

//   // 2) Generate the random reset token
//   const resetToken = user.createPasswordResetToken();
//   await user.save({ validateBeforeSave: false });

//   // 3) Send it to user's email
//   try {
//     const resetURL = `${req.protocol}://${req.get(
//       'host'
//     )}/api/v1/users/resetPassword/${resetToken}`;
//     await new Email(user, resetURL).sendPasswordReset();

//     res.status(200).json({
//       status: 'success',
//       message: 'Token sent to email!'
//     });
//   } catch (err) {
//     user.passwordResetToken = undefined;
//     user.passwordResetExpires = undefined;
//     await user.save({ validateBeforeSave: false });

//     return next(
//       new AppError('There was an error sending the email. Try again later!'),
//       500
//     );
//   }
// });
