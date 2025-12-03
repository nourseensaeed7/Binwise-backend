
import jwt from "jsonwebtoken";

const userAuth = async (req, res, next) => {
  try {
    let token;

    // 1. First check cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. If not in cookie, check Authorization header
    if (!token) {
      const authHeader = req.headers["authorization"] || req.headers["Authorization"];
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    // 3. If still no token → unauthorized
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized, no token" });
    }

    // 4. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.id) {
      req.userId = decoded.id;   // safe place to store userId
      req.userRole = decoded.role; // store role if you need role-based auth
      next();
    } else {
      return res.status(401).json({ success: false, message: "Invalid token payload" });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: error.message });
  }
};

export default userAuth;

