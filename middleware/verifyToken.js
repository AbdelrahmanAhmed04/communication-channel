require('dotenv').config();

function verifyToken(req, res, next) {
  const token = req.headers['authorization'];

  if (token === `Bearer ${process.env.API_SECRET}`) {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden' });
  }
}

module.exports = verifyToken;
