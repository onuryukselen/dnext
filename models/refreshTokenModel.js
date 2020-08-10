const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
  token: String,
  userId: {
    type: String,
    trim: true,
    default: null
  },
  clientId: {
    type: String,
    trim: true,
    required: true
  },
  scope: {
    type: String
  }
});

// userSchema.pre(/^find/, function(next) {
//   // this points to the current query
//   this.find({ active: { $ne: false } });
//   next();
// });

const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);

module.exports = RefreshToken;
