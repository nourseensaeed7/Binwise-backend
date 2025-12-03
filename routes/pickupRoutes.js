import express from "express";
import Pickup from "../models/pickupModel.js";
import userModel from "../models/userModel.js";
import authMiddleware from "../middleware/authMiddleware.js";
import roleAuth from "../middleware/roleAuth.js";

const router = express.Router();

// 🎯 POINTS CALCULATION HELPER FUNCTION
const calculatePointsAndDistributeWeight = (items, totalWeight) => {
  const POINTS_PER_KG = {
    Plastic: 167, plastic: 167,
    Paper: 53, paper: 53,
    Metal: 287, metal: 287,
    Glass: 23, glass: 23,
    "E-Waste": 20, "e-waste": 20,
    electronics: 2000, Electronics: 2000,
    cardboard: 53, Cardboard: 53,
    clothes: 117, Clothes: 117,
    wood: 100, Wood: 100,
  };
  
  const totalItemWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  const hasItemWeights = totalItemWeight > 0;
  
  let processedItems = [...items];
  
  if (!hasItemWeights && totalWeight > 0) {
    const weightPerItem = totalWeight / items.length;
    processedItems = items.map(item => ({
      ...item,
      weight: weightPerItem
    }));
  }
  
  const totalPoints = processedItems.reduce((acc, item) => {
    const perKg = POINTS_PER_KG[item.type] || 0;
    return acc + perKg * (item.weight || 0);
  }, 0);
  
  return {
    processedItems,
    totalPoints: Math.round(totalPoints)
  };
};

const calculateGains = (points) => {
  return parseFloat((points * 0.15).toFixed(2));
};

// ✅ IMPROVED: Helper to safely emit socket events with user-specific rooms
const emitSocketEvent = (req, eventName, data, userId = null) => {
  try {
    // ✅ Check if req.io exists
    if (!req.io) {
      console.log(`⚠️ Socket.io not available for event: ${eventName}`);
      return false;
    }
    
    if (typeof req.io.emit === 'function') {
      // Emit to all clients
      req.io.emit(eventName, data);
      
      // Also emit to specific user room if userId provided
      if (userId) {
        req.io.to(`user:${userId}`).emit(eventName, data);
        console.log(`📡 Socket event emitted to user ${userId}: ${eventName}`);
      } else {
        console.log(`📡 Socket event emitted globally: ${eventName}`);
      }
      
      return true;
    } else {
      console.log(`⚠️ req.io.emit is not a function for event: ${eventName}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error emitting socket event ${eventName}:`, error.message);
    return false;
  }
};
// -----------------------------
// 🧾 Get all pickups (Admin only)
// -----------------------------
router.get("/", authMiddleware, roleAuth("admin"), async (req, res) => {
  try {
    const pickups = await Pickup.find()
      .populate("userId", "name email")
      .populate("deliveryAgentId", "name email")
      .sort({ createdAt: -1 });
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
    
    const { items, address, pickupTime, time_slot, weight, instructions } = req.body;

    // Validation
    if (!address || !items || !weight || !pickupTime || !time_slot) {
      console.log("❌ Validation failed - missing fields");
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.log("❌ Validation failed - invalid items");
      return res.status(400).json({
        success: false,
        message: "Items must be a non-empty array",
      });
    }

    const { processedItems, totalPoints } = calculatePointsAndDistributeWeight(items, weight);
    const totalGains = calculateGains(totalPoints);

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

    // Populate pickup details
    await pickup.populate("userId", "name email");

    console.log("✅ Pickup created:", pickup._id);

    // ✅ Try to add activity, but don't fail if it errors
    try {
      await userModel.findByIdAndUpdate(req.userId, {
        $push: {
          activity: {
            action: `Created pickup request - ${totalPoints} points pending`,
            points: 0,
            gains: 0,
            date: new Date(),
          },
        },
      });
      console.log("✅ Activity added to user");
    } catch (activityError) {
      console.error("⚠️ Failed to add activity (non-critical):", activityError.message);
      // Don't throw - pickup was created successfully
    }

    // ✅ Try to emit socket event, but don't fail if it errors
    emitSocketEvent(req, "new-pickup", {
      pickup,
      userId: req.userId,
      timestamp: new Date()
    });
    
    emitSocketEvent(req, "pickup-created", {
      pickup,
      message: "Your pickup request was created successfully"
    }, req.userId);

    // ✅ Return success even if socket emit failed
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

    if (req.userRole !== "admin" && pickup.deliveryAgentId?.toString() !== req.userId) {
      console.log("❌ Not authorized");
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (pickup.status === "completed") {
      console.log("❌ Already completed");
      return res.status(400).json({ success: false, message: "Already completed" });
    }

    const { totalPoints } = calculatePointsAndDistributeWeight(pickup.items, pickup.weight);
    const totalGains = calculateGains(totalPoints);
    
    pickup.awardedPoints = totalPoints;
    pickup.gains = totalGains;
    pickup.status = "completed";
    await pickup.save();

    console.log("💰 Awarding points:", totalPoints, "and gains:", totalGains);

    // ✅ Update user points, gains, and activity
    const updatedUser = await userModel.findByIdAndUpdate(
      pickup.userId,
      {
        $inc: { 
          points: totalPoints,
          gains: totalGains,
          daysRecycled: 1
        },
        $push: {
          activity: {
            action: `Pickup completed - Earned ${totalPoints} points (${totalGains} EGP)`,
            points: totalPoints,
            gains: totalGains,
            date: new Date(),
          },
        },
      },
      { new: true }
    ).select("points gains activity");

    console.log("✅ Pickup completed and user updated");

    // Populate for socket emission
    await pickup.populate("userId", "name email");
    await pickup.populate("deliveryAgentId", "name email");

    // Emit to all clients
    emitSocketEvent(req, "pickup-completed", {
      pickup,
      userId: pickup.userId._id,
      timestamp: new Date()
    });
    
    // Emit specifically to the user
    emitSocketEvent(req, "points-awarded", {
      points: totalPoints,
      gains: totalGains,
      totalPoints: updatedUser.points,
      totalGains: updatedUser.gains,
      message: `Congratulations! You earned ${totalPoints} points (${totalGains} EGP)`
    }, pickup.userId._id.toString());

    res.json({ 
      success: true, 
      pickup, 
      awardedPoints: totalPoints,
      gains: totalGains,
      user: {
        points: updatedUser.points,
        gains: updatedUser.gains,
        latestActivity: updatedUser.activity[updatedUser.activity.length - 1]
      },
      message: "Pickup completed successfully"
    });
  } catch (error) {
    console.error("❌ Error completing pickup:", error);
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }

    if (req.userRole !== "admin" && pickup.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (pickup.status === "completed") {
      return res.status(400).json({ success: false, message: "Cannot delete completed pickups" });
    }

    await Pickup.findByIdAndDelete(id);

    // Add activity log
    await userModel.findByIdAndUpdate(pickup.userId, {
      $push: {
        activity: {
          action: "Pickup request cancelled",
          points: 0,
          gains: 0,
          date: new Date(),
        },
      },
    });

    emitSocketEvent(req, "pickup-deleted", { 
      pickupId: id,
      userId: pickup.userId,
      timestamp: new Date()
    });

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
    const { address, items, weight, instructions, pickupTime, time_slot } = req.body;

    const pickup = await Pickup.findById(id);
    if (!pickup) {
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }

    if (req.userRole !== "admin" && pickup.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (pickup.status !== "pending") {
      return res.status(400).json({ success: false, message: "Only pending pickups can be updated" });
    }

    if (address) pickup.address = address;
    if (instructions !== undefined) pickup.instructions = instructions;
    if (pickupTime) pickup.pickupTime = new Date(pickupTime);
    if (time_slot) pickup.time_slot = time_slot;

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
    }

    await pickup.save();

    emitSocketEvent(req, "pickup-updated", {
      pickup,
      userId: pickup.userId,
      timestamp: new Date()
    });

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

    const pickup = await Pickup.findById(id);
    if (!pickup) {
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }

    pickup.deliveryAgentId = deliveryAgentId;
    pickup.pickupTime = pickupTime ? new Date(pickupTime) : new Date();
    pickup.status = "assigned";
    await pickup.save();

    await pickup.populate("deliveryAgentId", "name email");

    emitSocketEvent(req, "pickup-assigned", {
      pickup,
      userId: pickup.userId,
      agentId: deliveryAgentId,
      timestamp: new Date()
    });

    res.json({ success: true, pickup });
  } catch (error) {
    console.error("❌ Error assigning pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;