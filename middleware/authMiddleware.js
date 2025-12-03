import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
  try {
    console.log("🔍 Auth middleware triggered");
    console.log("- Cookies:", req.cookies);
    console.log("- Authorization header:", req.headers.authorization);
    
    // Get token from cookie or Authorization header
    let token = req.cookies?.token;
    
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      console.log("❌ No token found");
      return res.status(401).json({ 
        success: false, 
        message: "Not authenticated - No token provided" 
      });
    }

    console.log("✅ Token found:", token.substring(0, 20) + "...");

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token decoded:", decoded);
    
    // Attach to request
    req.userId = decoded.id;
    req.userRole = decoded.role;
    
    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error.message);
    return res.status(401).json({ 
      success: false, 
      message: "Invalid or expired token",
      error: error.message 
    });
  }
};

export default authMiddleware;
