const RefreshToken = require('../models/refreshTokenModel');

exports.find = async token => {
  return await RefreshToken.findOne({ token: token }, function(err, item) {
    console.log('RefreshToken find err1:', err);
    console.log('RefreshToken find item1:', item);
    if (err) {
      return err;
    }
    return item;
  });
};

exports.save = async (token, userId, clientId, scope) => {
  try {
    const newToken = new RefreshToken({
      token: token,
      userId: userId,
      clientId: clientId,
      scope: scope
    });
    const saveToken = await newToken.save(); //when fail its goes to catch
    return saveToken;
  } catch (err) {
    return err;
  }
};

exports.delete = async token => {
  return await RefreshToken.findOneAndRemove({ token: token }, function(err, item) {
    console.log('err3:', err);
    console.log('item3:', item);
    if (err) {
      return err;
    }
    return item;
  });
};
