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
    clothes: 117,
    Clothes: 117,
    wood: 100,
    Wood: 100,
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

// GAINS CALCULATION: 1 point = 0.15 EGP
const calculateGains = (points) => {
  return parseFloat((points * 0.15).toFixed(2));
};

// Helper to safely emit socket events
const emitSocketEvent = (req, eventName, data) => {
  try {
    if (req.io && typeof req.io.emit === 'function') {
      req.io.emit(eventName, data);
      console.log(`📡 Socket event emitted: ${eventName}`);
    } else {
      console.log(`⚠️ Socket.io not available, skipping event: ${eventName}`);
    }
  } catch (error) {
    console.error(`❌ Error emitting socket event ${eventName}:`, error.message);
  }
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
    console.error("❌ Error fetching pickups:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// 👤 Get current user's pickups
// -----------------------------
router.get("/my", authMiddleware, async (req, res) => {
  try {
    console.log("📋 Fetching pickups for user:", req.userId);
    
    const pickups = await Pickup.find({ userId: req.userId })
      .populate("deliveryAgentId", "name email role")
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${pickups.length} pickups`);
    res.json({ success: true, pickups });
  } catch (error) {
    console.error("❌ Error fetching user pickups:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// ♻️ Create a new pickup
// -----------------------------
router.post("/", authMiddleware, async (req, res) => {
  try {
    console.log("📥 Creating pickup request...");
    console.log("User ID:", req.userId);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    const { items, address, pickupTime, time_slot, weight, instructions } = req.body;

    // Validation
    if (!address || !items || !weight || !pickupTime || !time_slot) {
      console.log("❌ Validation failed - missing fields");
      return res.status(400).json({
        success: false,
        message: "Missing required fields: address, items, weight, pickupTime, and time_slot",
      });
    }

    // Validate items is an array
    if (!Array.isArray(items) || items.length === 0) {
      console.log("❌ Validation failed - invalid items");
      return res.status(400).json({
        success: false,
        message: "Items must be a non-empty array",
      });
    }

    console.log("✅ Validation passed");

    // CALCULATE POINTS AND DISTRIBUTE WEIGHT AUTOMATICALLY
    const { processedItems, totalPoints } = calculatePointsAndDistributeWeight(items, weight);
    console.log("📊 Calculated points:", totalPoints);
    
    // CALCULATE GAINS (1 point = 0.15 EGP)
    const totalGains = calculateGains(totalPoints);
    console.log("💰 Calculated gains:", totalGains);

    // Create pickup
    const pickup = await Pickup.create({
      userId: req.userId,
      address,
      items: processedItems, 
      weight,
      instructions: instructions || "",
      pickupTime: new Date(pickupTime),
      time_slot,
      awardedPoints: totalPoints,
      gains: totalGains,
      status: "pending",
    });

    console.log("✅ Pickup created:", pickup._id);

    // Emit socket event safely
    emitSocketEvent(req, "new-pickup", pickup);

    res.status(201).json({ 
      success: true, 
      pickup,
      awardedPoints: totalPoints,
      gains: totalGains,
      message: "Pickup request created successfully"
    });
  } catch (error) {
    console.error("❌ Error creating pickup:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create pickup",
      error: error.message 
    });
  }
});

// -----------------------------
// 🗑️ Delete a pickup
// -----------------------------
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🗑️ Deleting pickup:", id);
    
    const pickup = await Pickup.findById(id);
    if (!pickup) {
      console.log("❌ Pickup not found");
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }

    // Check authorization
    if (req.userRole !== "admin" && pickup.userId.toString() !== req.userId) {
      console.log("❌ Not authorized");
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (pickup.status === "completed") {
      console.log("❌ Cannot delete completed pickup");
      return res.status(400).json({ success: false, message: "Cannot delete completed pickups" });
    }

    await Pickup.findByIdAndDelete(id);
    console.log("✅ Pickup deleted");

    // Emit socket event safely
    emitSocketEvent(req, "delete-pickup", id);

    res.json({ success: true, message: "Pickup deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// ✏️ Update pickup (user only)
// -----------------------------
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("✏️ Updating pickup:", id);
    
    const { address, items, weight, instructions, pickupTime, time_slot } = req.body;

    const pickup = await Pickup.findById(id);
    if (!pickup) {
      console.log("❌ Pickup not found");
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }

    // Check authorization
    if (req.userRole !== "admin" && pickup.userId.toString() !== req.userId) {
      console.log("❌ Not authorized");
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (pickup.status !== "pending") {
      console.log("❌ Can only update pending pickups");
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
      pickup.gains = totalGains;
      
      console.log("📊 Recalculated - Points:", totalPoints, "Gains:", totalGains);
    }

    await pickup.save();
    console.log("✅ Pickup updated");

    // Emit socket event safely
    emitSocketEvent(req, "update-pickup", pickup);

    res.json({ 
      success: true, 
      pickup, 
      message: "Pickup updated successfully",
      awardedPoints: pickup.awardedPoints,
      gains: pickup.gains
    });
  } catch (error) {
    console.error("❌ Error updating pickup:", error);
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
    
    console.log("🚚 Assigning pickup:", id, "to agent:", deliveryAgentId);

    const pickup = await Pickup.findById(id);
    if (!pickup) {
      console.log("❌ Pickup not found");
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }

    pickup.deliveryAgentId = deliveryAgentId;
    pickup.pickupTime = pickupTime ? new Date(pickupTime) : new Date();
    pickup.status = "assigned";
    await pickup.save();

    console.log("✅ Pickup assigned");

    // Emit socket event safely
    emitSocketEvent(req, "update-pickup", pickup);

    res.json({ success: true, pickup });
  } catch (error) {
    console.error("❌ Error assigning pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------
// ✅ Complete pickup (admin or assigned agent)
// -----------------------------
router.put("/:id/complete", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("✅ Completing pickup:", id);
    
    const pickup = await Pickup.findById(id);
    if (!pickup) {
      console.log("❌ Pickup not found");
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }

    // Check authorization
    if (req.userRole !== "admin" && pickup.deliveryAgentId?.toString() !== req.userId) {
      console.log("❌ Not authorized");
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (pickup.status === "completed") {
      console.log("❌ Already completed");
      return res.status(400).json({ success: false, message: "Already completed" });
    }

    // ✅ Recalculate points and gains one final time
    const { totalPoints } = calculatePointsAndDistributeWeight(pickup.items, pickup.weight);
    const totalGains = calculateGains(totalPoints);
    
    pickup.awardedPoints = totalPoints;
    pickup.gains = totalGains;
    pickup.status = "completed";
    await pickup.save();

    console.log("💰 Awarding points:", totalPoints, "and gains:", totalGains);

    // ✅ Update user points and gains
    await userModel.findByIdAndUpdate(pickup.userId, {
      $inc: { 
        points: totalPoints,
        gains: totalGains
      },
      $push: {
        activity: {
          action: `Completed pickup worth ${totalPoints} points (${totalGains} EGP)`,
          points: totalPoints,
          gains: totalGains,
          date: new Date(),
        },
      },
    });

    console.log("✅ Pickup completed and user updated");

    // Emit socket event safely
    emitSocketEvent(req, "update-pickup", pickup);

    res.json({ 
      success: true, 
      pickup, 
      awardedPoints: totalPoints,
      gains: totalGains,
      message: "Pickup completed successfully"
    });
  } catch (error) {
    console.error("❌ Error completing pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;