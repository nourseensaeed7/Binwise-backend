import express from "express";
import { updateDailyProgress } from "../controllers/progressController.js"; // keep logic in controller

const router = express.Router();

// Define route
router.put("/progress", updateDailyProgress);

export default router; // now default export works with import progressRoutes
