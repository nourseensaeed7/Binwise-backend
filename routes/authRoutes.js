import express from "express";
import multer from "multer";
import fs from "fs";
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
import userModel from "../models/userModel.js";

const router = express.Router();

/* =====================================================
   MULTER SETUP - MUST BE AT TOP
===================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/profiles";
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profileImage-${Date.now()}${ext}`);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

/* =====================================================
   AUTH ROUTES
===================================================== */
router.post("/register", register);
router.post("/login", login);
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
   AUTH CHECK
===================================================== */
router.get("/is-auth", authMiddleware, isAuthenticated);

/* =====================================================
   USER PROFILE
===================================================== */
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    console.log("📋 Fetching profile for user:", req.userId);
    
    const user = await userModel.findById(req.userId).select("-password");
    
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
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
      profileImage: user.profileImage || null,
      points: user.points || 0,
      gains: user.gains || 0,
      daysRecycled: user.daysRecycled || 0,
      activity: user.activity || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    
    console.log("✅ Profile fetched successfully");
    
    res.json({
      success: true,
      user: userData,
      userData: userData,
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

/* =====================================================
   UPDATE PROFILE
===================================================== */
router.put("/update-profile", authMiddleware, upload.single("profileImage"), async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const userId = req.userId;

    console.log("📝 Updating profile for user:", userId);
    console.log("   Phone:", phone);
    console.log("   Address:", address);
    console.log("   File uploaded:", !!req.file);
    if (req.file) {
      console.log("   File details:", req.file);
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Update phone if provided
    if (phone !== undefined) {
      user.phone = phone;
    }

    // Update address if provided
    if (address !== undefined) {
      user.address = address;
    }

    // Handle profile image upload
    if (req.file) {
      // Delete old profile image if it exists
      if (user.profileImage) {
        const oldImagePath = path.join(process.cwd(), user.profileImage.replace(/^\//, ''));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log("   🗑️ Deleted old image:", oldImagePath);
        }
      }

      // Save new image path (relative path for frontend to access)
      user.profileImage = `/uploads/profiles/${req.file.filename}`;
      console.log("   ✅ New image saved:", user.profileImage);
    }

    await user.save();

    console.log("✅ Profile updated successfully");

    // Return updated user data
    res.json({
      success: true,
      message: "Profile updated successfully",
      userData: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        profileImage: user.profileImage,
        level: user.level,
        points: user.points,
        gains: user.gains,
        daysRecycled: user.daysRecycled,
      },
    });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
});

/* =====================================================
   ADD USER ACTIVITY
===================================================== */
router.post("/add-activity", authMiddleware, async (req, res) => {
  try {
    const { activities } = req.body;

    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({ success: false, message: "Activities array required" });
    }

    await userModel.findByIdAndUpdate(req.userId, {
      $push: { activity: { $each: activities } }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


