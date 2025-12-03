import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import roleAuth from "../middleware/roleAuth.js";
import userModel from "../models/userModel.js";

const router = express.Router();

/* =====================================================
   📋 GET ALL USERS — ADMIN ONLY
===================================================== */
router.get("/", authMiddleware, roleAuth("admin"), async (req, res) => {
  try {
    const users = await userModel.find().select(
      "name email role createdAt points level daysRecycled badges stats"
    );

    return res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================
   👤 GET CURRENT LOGGED-IN USER
===================================================== */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await userModel.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      userData: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        level: user.level,
        daysRecycled: user.daysRecycled,
        badges: user.badges,
        stats: user.stats,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
