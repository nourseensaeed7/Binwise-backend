import express from "express";
import Pickup from "../models/pickupModel.js";
import userModel from "../models/userModel.js";
import authMiddleware from "../middleware/authMiddleware.js";
import roleAuth from "../middleware/roleAuth.js";

const router = express.Router();

// 🎯 POINTS CALCULATION HELPER FUNCTION
const calculatePointsAndDistributeWeight = (items, totalWeight) => {
  const POINTS_PER_KG = {
    Plastic: 167,
    plastic: 167,
    Paper: 53,
    paper: 53,
    Metal: 287,
    metal: 287,
    Glass: 23,
    glass: 23,
    "E-Waste": 20,
    "e-waste": 20,
    electronics: 2000,
    Electronics: 2000,
    cardboard: 53,
    Cardboard: 53,
    clothes:117,
    Clothes:117,
  };
  
  // Check if items already have weights
  const totalItemWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  const hasItemWeights = totalItemWeight > 0;
  
  let processedItems = [...items];
  
  // If items don't have individual weights, distribute total weight evenly
  if (!hasItemWeights && totalWeight > 0) {
    const weightPerItem = totalWeight / items.length;
    processedItems = items.map(item => ({
      ...item,
      weight: weightPerItem
    }));
  }
  
  // Calculate total points
  const totalPoints = processedItems.reduce((acc, item) => {
    const perKg = POINTS_PER_KG[item.type] || 0;
    return acc + perKg * (item.weight || 0);
  }, 0);
  
  return {
    processedItems,
    totalPoints: Math.round(totalPoints) // Round to nearest integer
  };
};

//GAINS CALCULATION: 1 point = 0.15 EGP
const calculateGains = (points) => {
  return parseFloat((points * 0.15).toFixed(2));
};

// -----------------------------
// 🧾 Get all pickups (Admin only)
// -----------------------------
router.get("/", authMiddleware, roleAuth("admin"), async (req, res) => {
  try {
    const pickups = await Pickup.find()
      .populate("userId", "name email")
      .populate("deliveryAgentId", "name email");
    res.json({ success: true, pickups });
  } catch (error) {
    console.error("Error fetching pickups:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// 👤 Get current user's pickups
// -----------------------------
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const pickups = await Pickup.find({ userId: req.userId })
      .populate("deliveryAgentId", "name email role")
      .sort({ createdAt: -1 });
    res.json({ success: true, pickups });
  } catch (error) {
    console.error("Error fetching user pickups:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// ♻️ Create a new pickup
// -----------------------------
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { items, address, pickupTime, time_slot, weight, instructions } = req.body;

    if (!address || !items || !weight || !pickupTime || !time_slot) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: address, items, weight, pickupTime, and time_slot",
      });
    }

    // CALCULATE POINTS AND DISTRIBUTE WEIGHT AUTOMATICALLY
    const { processedItems, totalPoints } = calculatePointsAndDistributeWeight(items, weight);
    
    //  CALCULATE GAINS (1 point = 0.15 EGP)
    const totalGains = calculateGains(totalPoints);

    const pickup = await Pickup.create({
      userId: req.userId,
      address,
      items: processedItems, 
      weight,
      instructions,
      pickupTime: new Date(pickupTime),
      time_slot,
      awardedPoints: totalPoints,
      gains: totalGains, 
    });

    // Emit event for admin dashboard
    // io.emit("new-pickup", pickup);

    res.status(201).json({ 
      success: true, 
      pickup,
      awardedPoints: totalPoints,
      gains: totalGains // Return gains in response
    });
  } catch (error) {
    console.error("Error creating pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// 🗑️ Delete a pickup
// -----------------------------
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pickup = await Pickup.findById(id);
    if (!pickup) return res.status(404).json({ success: false, message: "Pickup not found" });

    if (req.userRole !== "admin" && pickup.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (pickup.status === "completed") {
      return res.status(400).json({ success: false, message: "Cannot delete completed pickups" });
    }

    await Pickup.findByIdAndDelete(id);

    // 📢 Emit event for admin dashboard
    // io.emit("delete-pickup", id);

    res.json({ success: true, message: "Pickup deleted successfully" });
  } catch (error) {
    console.error("Error deleting pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// ✏️ Update pickup (user only)
// -----------------------------
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { address, items, weight, instructions, pickupTime, time_slot, awardedPoints, gains } = req.body;

    const pickup = await Pickup.findById(id);
    if (!pickup) return res.status(404).json({ success: false, message: "Pickup not found" });

    if (req.userRole !== "admin" && pickup.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (pickup.status !== "pending") {
      return res.status(400).json({ success: false, message: "Only pending pickups can be updated" });
    }

    // Update basic fields
    if (address) pickup.address = address;
    if (instructions !== undefined) pickup.instructions = instructions;
    if (pickupTime) pickup.pickupTime = new Date(pickupTime);
    if (time_slot) pickup.time_slot = time_slot;

    // ✅ RECALCULATE POINTS AND GAINS if items or weight changed
    if (items || weight) {
      const updatedItems = items || pickup.items;
      const updatedWeight = weight || pickup.weight;
      
      const { processedItems, totalPoints } = calculatePointsAndDistributeWeight(
        updatedItems,
        updatedWeight
      );
      
      const totalGains = calculateGains(totalPoints);
      
      pickup.items = processedItems;
      pickup.weight = updatedWeight;
      pickup.awardedPoints = totalPoints;
      pickup.gains = totalGains; // ✅ Update gains
    }

    await pickup.save();

    // 📢 Emit event for admin dashboard
    // io.emit("update-pickup", pickup);

    res.json({ 
      success: true, 
      pickup, 
      message: "Pickup updated successfully",
      awardedPoints: pickup.awardedPoints,
      gains: pickup.gains // ✅ Return updated gains
    });
  } catch (error) {
    console.error("Error updating pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// 🚚 Assign pickup to agent (admin)
// -----------------------------
router.put("/:id/assign", authMiddleware, roleAuth("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryAgentId, pickupTime } = req.body;

    const pickup = await Pickup.findById(id);
    if (!pickup) return res.status(404).json({ success: false, message: "Pickup not found" });

    pickup.deliveryAgentId = deliveryAgentId;
    pickup.pickupTime = pickupTime ? new Date(pickupTime) : new Date();
    pickup.status = "assigned";
    await pickup.save();

    // 📢 Emit event for admin dashboard
    // io.emit("update-pickup", pickup);

    res.json({ success: true, pickup });
  } catch (error) {
    console.error("Error assigning pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// ✅ Complete pickup (admin or assigned agent)
// -----------------------------
router.put("/:id/complete", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pickup = await Pickup.findById(id);
    if (!pickup) return res.status(404).json({ success: false, message: "Pickup not found" });

    if (req.userRole !== "admin" && pickup.deliveryAgentId?.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (pickup.status === "completed") {
      return res.status(400).json({ success: false, message: "Already completed" });
    }

    // ✅ Recalculate points and gains one final time to ensure accuracy
    const { totalPoints } = calculatePointsAndDistributeWeight(pickup.items, pickup.weight);
    const totalGains = calculateGains(totalPoints);
    
    pickup.awardedPoints = totalPoints;
    pickup.gains = totalGains; // ✅ Update gains
    pickup.status = "completed";
    await pickup.save();

    // ✅ NOW update user points and gains (only when completed, not when created)
    await userModel.findByIdAndUpdate(pickup.userId, {
      $inc: { 
        points: totalPoints,
        gains: totalGains // ✅ Update user's total gains
      },
      $push: {
        activity: {
          action: `Completed pickup worth ${totalPoints} points (${totalGains} EGP)`,
          points: totalPoints,
          gains: totalGains, // ✅ Store gains in activity
          date: new Date(),
        },
      },
    });
    // 📢 Emit event for admin dashboard
    // io.emit("update-pickup", pickup);

    res.json({ 
      success: true, 
      pickup, 
      awardedPoints: totalPoints,
      gains: totalGains // ✅ Return gains in response
    });
  } catch (error) {
    console.error("Error completing pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;