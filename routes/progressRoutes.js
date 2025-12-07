import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { updateDailyProgress } from "../controllers/progressController.js";

const router = express.Router();

// ✅ Apply auth middleware to protect the route
router.put("/progress", authMiddleware, updateDailyProgress);



export default router;