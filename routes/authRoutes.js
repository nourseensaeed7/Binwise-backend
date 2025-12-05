
import express from "express";
import multer from "multer";
import path from "path";
import {
  register,
  login,
  logout,
  sendVerifyOtp,
  verifyEmail,
  sendResetOtp,
  resetPassword,
  isAuthenticated,
  getUserProfile,
  updateProfile,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/userModel.js"; // <-- ensure this import exists
const router = express.Router();

/* =====================================================
   MULTER SETUP
===================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // فولدر لتخزين الصور
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profileImage-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

/* =====================================================
   AUTH ROUTES
===================================================== */
// 🆕 Register
router.post("/register", register);

// 🔐 Login
router.post("/login", login);

// 🚪 Logout
router.post("/logout", logout);

/* =====================================================
   EMAIL VERIFICATION
===================================================== */
router.post("/send-verify-otp", authMiddleware, sendVerifyOtp);
router.post("/verify-email", authMiddleware, verifyEmail);

/* =====================================================
   PASSWORD RESET
===================================================== */
router.post("/send-reset-otp", sendResetOtp);
router.post("/reset-password", resetPassword);

/* =====================================================
   AUTH CHECK (for frontend session persistence)
===================================================== */
router.get("/is-auth", authMiddleware, isAuthenticated);

/* =====================================================
   USER PROFILE
===================================================== */
// 📄 Get user profile data
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    console.log("📋 Fetching profile for user:", req.userId);
    
    // ✅ Fetch user with all fields except password
    const user = await userModel.findById(req.userId).select("-password");
    
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // ✅ Ensure activity is an array (fix for undefined.length error)
    if (!Array.isArray(user.activity)) {
      user.activity = [];
    }
    
    // ✅ Ensure all numeric fields have default values
    const userData = {
      _id: user._id,
      id: user._id,
      name: user.name || "",
      email: user.email || "",
      address: user.address || "",
      phone: user.phone || "",
      role: user.role || "user",
      points: user.points || 0,
      gains: user.gains || 0,
      daysRecycled: user.daysRecycled || 0,
      activity: user.activity || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    
    console.log("✅ Profile fetched successfully");
    console.log("   - Points:", userData.points);
    console.log("   - Gains:", userData.gains);
    console.log("   - Activities:", userData.activity.length);
    
    res.json({
      success: true,
      user: userData,
      userData: userData, // ✅ Send both for compatibility
    });
  } catch (error) {
    console.error("❌ Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message
    });
  }
});

// ✅ Check if user is authenticated
router.get("/is-auth", authMiddleware, async (req, res) => {
  try {
    const user = await userModel.findById(req.userId).select("-password");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // ✅ Ensure activity is an array
    if (!Array.isArray(user.activity)) {
      user.activity = [];
    }
    
    const userData = {
      _id: user._id,
      id: user._id,
      name: user.name || "",
      email: user.email || "",
      address: user.address || "",
      phone: user.phone || "",
      role: user.role || "user",
      points: user.points || 0,
      gains: user.gains || 0,
      daysRecycled: user.daysRecycled || 0,
      activity: user.activity || [],
    };
    
    res.json({
      success: true,
      authenticated: true,
      userData: userData,
    });
  } catch (error) {
    console.error("❌ Auth check error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
/* =====================================================
   ADD USER ACTIVITY (from AI detection or manual pickup)
===================================================== */


router.post("/add-activity", authMiddleware, async (req, res) => {
  try {
    const { activities } = req.body;

    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({ success: false, message: "Activities array required" });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $push: { activity: { $each: activities } }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;







// import express from "express";
// import {
//   register,
//   login,
//   logout,
//   sendVerifyOtp,
//   verifyEmail,
//   sendResetOtp,
//   resetPassword,
//   isAuthenticated,
// } from "../controllers/authController.js";
// import userAuth from "../middleware/userAuth.js";

// const router = express.Router();

// // Auth routes
// router.post("/register", register);
// router.post("/login", login);

// // ✅ Logout should NOT require userAuth (token may already be expired)
// router.post("/logout", logout);

// // Email verification
// router.post("/send-verify-otp", userAuth, sendVerifyOtp);
// router.post("/verify-email", userAuth, verifyEmail);

// // Password reset
// router.post("/send-reset-otp", sendResetOtp);
// router.post("/reset-password", resetPassword);

// // Auth check
// router.get("/is-auth", userAuth, isAuthenticated);

// export default router;

// import express from "express";
// import {
//   register,
//   login,
//   logout,
//   sendVerifyOtp,
//   verifyEmail,
//   isAuthenticated,
//   sendResetOtp,
//   resetPassword,
// } from "../controllers/authController.js";
// import userAuth from "../middleware/userAuth.js"; // ✅ middleware for protecting routes
// import userModel from "../models/userModel.js";

// const router = express.Router();

// // ========== PUBLIC ROUTES ==========
// router.post("/register", register);
// router.post("/login", login);
// router.post("/send-reset-otp", sendResetOtp);
// router.post("/reset-password", resetPassword);

// // ========== PROTECTED ROUTES ==========
// router.post("/logout", userAuth, logout);
// router.post("/send-verify-otp", userAuth, sendVerifyOtp);
// router.post("/verify-account", userAuth, verifyEmail);
// router.get("/is-auth", userAuth, isAuthenticated);

// // ========== (Optional) DEBUG ROUTE ==========
// router.get("/all-users", async (req, res) => {
//   try {
//     const users = await userModel
//       .find()
//       .select("name email role isAccountVerified createdAt");
//     res.json({ success: true, users });
//   } catch (error) {
//     res.json({ success: false, message: error.message });
//   }
// });

// export default router;


