/*import express from "express";
import {
  register,
  login,
  logout,
  sendVerifyOtp,
  verifyEmail,
  sendResetOtp,
  resetPassword,
  isAuthenticated,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/* =====================================================
   AUTH ROUTES
===================================================== */

// 🆕 Register
//router.post("/register", register);

// 🔐 Login
//router.post("/login", login);

// 🚪 Logout
// Note: logout should NOT require authMiddleware (token may already be expired)
//router.post("/logout", logout);

/* =====================================================
   EMAIL VERIFICATION
===================================================== */
//router.post("/send-verify-otp", authMiddleware, sendVerifyOtp);
//router.post("/verify-email", authMiddleware, verifyEmail);

/* =====================================================
   PASSWORD RESET
===================================================== */
//router.post("/send-reset-otp", sendResetOtp);
//router.post("/reset-password", resetPassword);

/* =====================================================
   AUTH CHECK (for frontend session persistence)
===================================================== */
//router.get("/is-auth", authMiddleware, isAuthenticated);

//export default router;
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
router.get("/profile", authMiddleware, getUserProfile);

// ✏️ Update user profile data with image upload
router.put(
  "/update-profile",
  authMiddleware,
  upload.single("profileImage"),
  updateProfile
);
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


