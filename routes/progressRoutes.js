import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { updateDailyProgress } from "../controllers/progressController.js";

const router = express.Router();

// ✅ Apply auth middleware to protect the route
router.put("/progress", authMiddleware, updateDailyProgress);

// ✅ Alternative: You can also define the route handler inline if needed
// router.put("/progress", authMiddleware, async (req, res) => {
//   try {
//     // Your progress update logic here
//     res.json({ success: true, message: "Progress updated" });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

export default router;