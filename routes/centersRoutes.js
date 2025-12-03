import express from "express";
import {
  getAllCenters,
  getCenterById,
  createCenter,
  updateCenter,
  deleteCenter,
  getNearbyCenters,
} from "../controllers/centersController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import roleAuth from "../middleware/roleAuth.js";

const router = express.Router();

/* =====================================================
   PUBLIC ROUTES
===================================================== */
// Get all centers (public can view)
router.get("/", getAllCenters);

// Get center by ID
router.get("/:id", getCenterById);

// Get nearby centers
router.get("/nearby/search", getNearbyCenters);

/* =====================================================
   ADMIN ROUTES
===================================================== */
// Create center (admin only)
router.post("/", authMiddleware, roleAuth("admin"), createCenter);

// Update center (admin only)
router.put("/:id", authMiddleware, roleAuth("admin"), updateCenter);

// Delete center (admin only)
router.delete("/:id", authMiddleware, roleAuth("admin"), deleteCenter);

export default router;