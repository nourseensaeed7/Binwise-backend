// middleware/roleAuth.js
const roleAuth = (...allowedRoles) => {
    return (req, res, next) => {
      if (!req.userRole || !allowedRoles.includes(req.userRole)) {
        return res.status(403).json({ success: false, message: "Not authorized" });
      }
      next();
    };
  };
  
  export default roleAuth;
  