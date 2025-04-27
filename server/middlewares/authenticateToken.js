import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  const accessToken = req.header("Authorization");
  if (!accessToken) {
    return res.status(401).json({ error: "Invalid token" });
  }

  jwt.verify(accessToken, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: "Token expired" });
    if (!user.username) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }
    req.username = user.username;
    next();
  });
};

const checkIsJson = (req, res, next) => {
  if (!req.is("application/json")) {
    return res.status(400).json({ error: "Request not JSON" });
  }
  next();
};

// const checkAdminPermission = async (req, res, next) => {
//   const user = await User.findOne({ _id: req.userId });
//   if (!user) return res.status(404).json({ error: "User not found" });
//   if (user.role !== "admin") {
//     return res.status(403).json({ error: "You don't have permission" });
//   }
//   req.user = user;
//   next();
// };

// module.exports = { authenticateToken, JWT_SECRET, checkIsJson, checkAdminPermission };

export { authenticateToken, JWT_SECRET, checkIsJson };
