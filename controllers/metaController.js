const passport = require('passport');

/**
 * https://localhost:4000/api/v1/meta/protectedEndPoint
 *
 * An example protected endPoint
 *
 * This endpoint is protected to where you have to send the Authorization Bearer
 * token to it and that token has to be valid on the authorization server.  If the
 * user is authenticated the it will send a plain text message back.
 * @param   {Object}   req - The request, which nothing is done with
 * @param   {Object}   res - The response, which the protectedEndPoint is rendered
 * @returns {undefined}
 */
exports.protectedEndPoint = [
  passport.authenticate('bearer', { session: false }),
  (req, res) => {
    console.log(req.accessToken);
    // You can send whatever you want, such as JSON, etc...
    // For a illustrative example, I'm just sending a string back
    res.send('Successful Protected EndPoint Data Call');
  }
];
