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

// ✅ SAFE: Helper to emit socket events - NEVER uses 'io' directly
const emitSocketEvent = (req, eventName, data, userId = null) => {
  try {
    // ✅ Safety checks
    if (!req) {
      console.error(`⚠️ [${eventName}] req object is undefined`);
      return false;
    }

    if (!req.io) {
      console.error(`⚠️ [${eventName}] req.io is undefined - Socket.io not available`);
      console.error(`   This usually means the io middleware didn't run before this route`);
      return false;
    }
    
    if (typeof req.io.emit !== 'function') {
      console.error(`⚠️ [${eventName}] req.io.emit is not a function`);
      console.error(`   req.io type:`, typeof req.io);
      return false;
    }
    
    // ✅ Emit to admin room for admin dashboard
    req.io.to("admin").emit(eventName, data);
    console.log(`📡 [ADMIN] Emitted ${eventName} to admin room`);
    
    // ✅ Also emit to specific user room if userId provided
    if (userId) {
      const userIdString = userId.toString();
      req.io.to(`user:${userIdString}`).emit(eventName, data);
      console.log(`📡 [USER:${userIdString}] Emitted ${eventName}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error emitting socket event ${eventName}:`, error.message);
    console.error(`   Stack:`, error.stack);
    return false;
  }
};

// -----------------------------
// 🧪 Debug endpoint to test Socket.IO
// -----------------------------
router.get("/test-socket", authMiddleware, async (req, res) => {
  console.log("🧪 Testing Socket.IO availability...");
  console.log("   req exists?", typeof req !== 'undefined');
  console.log("   req.io exists?", typeof req.io !== 'undefined');
  console.log("   req.io.emit exists?", typeof req.io?.emit === 'function');
  
  const testResult = emitSocketEvent(req, "test-event", { 
    message: "Test from pickup routes",
    timestamp: new Date(),
    userId: req.userId
  }, req.userId);
  
  res.json({
    success: true,
    socketAvailable: typeof req.io !== 'undefined',
    emitFunctionExists: typeof req.io?.emit === 'function',
    testEmitResult: testResult,
    connectedClients: req.io?.engine?.clientsCount || 0,
    yourUserId: req.userId
  });
});

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
    console.log("   User ID:", req.userId);
    console.log("   req.io available?", typeof req.io !== 'undefined');
    
    const { items, address, pickupTime, time_slot, weight, instructions } = req.body;

    // ✅ Validation
    if (!address || !items || !weight || !pickupTime || !time_slot) {
      console.log("❌ Validation failed - missing fields");
      return res.status(400).json({
        success: false,
        message: "Missing required fields: address, items, weight, pickupTime, and time_slot",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.log("❌ Validation failed - invalid items");
      return res.status(400).json({
        success: false,
        message: "Items must be a non-empty array",
      });
    }

    console.log("✅ Validation passed");

    // ✅ Calculate points
    const { processedItems, totalPoints } = calculatePointsAndDistributeWeight(items, weight);
    console.log("   Calculated points:", totalPoints);
    
    const totalGains = calculateGains(totalPoints);
    console.log("   Calculated gains:", totalGains);

    // ✅ Create pickup
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

    // ✅ Populate pickup details
    await pickup.populate("userId", "name email");

    console.log("✅ Pickup created:", pickup._id);

    // ✅ Add activity to user immediately
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

    // ✅ Emit socket events using req.io (NOT io directly)
    console.log("📡 Emitting socket events for new pickup...");
    
    emitSocketEvent(req, "new-pickup", {
      pickup,
      userId: req.userId,
      timestamp: new Date()
    });
    
    emitSocketEvent(req, "pickup-created", {
      pickup,
      message: "Your pickup request was created successfully"
    }, req.userId);

    res.status(201).json({ 
      success: true, 
      pickup,
      awardedPoints: totalPoints,
      gains: totalGains,
      message: "Pickup request created successfully"
    });
  } catch (error) {
    console.error("❌ Error creating pickup:", error);
    console.error("   Stack:", error.stack);
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
    console.log("   req.io available?", typeof req.io !== 'undefined');
    
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

    // ✅ Populate for response
    await pickup.populate("userId", "name email");
    await pickup.populate("deliveryAgentId", "name email");

    // ✅ Emit socket events using req.io
    console.log("📡 Emitting completion events...");
    
    const userIdString = pickup.userId._id.toString();
    
    emitSocketEvent(req, "pickup-completed", {
      pickup,
      userId: userIdString,
      timestamp: new Date()
    });
    
    emitSocketEvent(req, "points-awarded", {
      pickupId: pickup._id,
      points: totalPoints,
      gains: totalGains,
      totalPoints: updatedUser.points,
      totalGains: updatedUser.gains,
      message: `Congratulations! You earned ${totalPoints} points (${totalGains} EGP)`
    }, userIdString);

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
    console.log("   req.io available?", typeof req.io !== 'undefined');
    
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

    // ✅ Store userId BEFORE deletion
    const userId = pickup.userId.toString();

    // ✅ Delete pickup
    await Pickup.findByIdAndDelete(id);

    // ✅ Update user activity
    await userModel.findByIdAndUpdate(userId, {
      $push: {
        activity: {
          action: "Pickup request cancelled",
          points: 0,
          gains: 0,
          date: new Date(),
        },
      },
    });

    // ✅ Emit socket events using req.io (NOT io directly)
    console.log("📡 Emitting deletion events...");
    
    emitSocketEvent(req, "pickup-deleted", { 
      pickupId: id,
      userId: userId,
      timestamp: new Date()
    });

    emitSocketEvent(req, "pickup-deleted-user", { 
      pickupId: id,
      message: "Pickup request cancelled successfully"
    }, userId);

    console.log("✅ Pickup deleted successfully");

    res.json({ success: true, message: "Pickup deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting pickup:", error);
    console.error("   Stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete pickup",
      error: error.message 
    });
  }
});

// -----------------------------
// ✏️ Update pickup (user only)
// -----------------------------
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("✏️ Updating pickup:", id);
    console.log("   req.io available?", typeof req.io !== 'undefined');
    
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
    await pickup.populate("userId", "name email");
    await pickup.populate("deliveryAgentId", "name email");

    // ✅ Emit socket events using req.io
    const userIdString = pickup.userId._id.toString();
    
    emitSocketEvent(req, "pickup-updated", {
      pickup,
      userId: userIdString,
      timestamp: new Date()
    });

    emitSocketEvent(req, "pickup-updated-user", {
      pickup,
      message: "Pickup updated successfully"
    }, userIdString);

    res.json({ 
      success: true, 
      pickup, 
      message: "Pickup updated successfully",
      awardedPoints: pickup.awardedPoints,
      gains: pickup.gains
    });
  } catch (error) {
    console.error("❌ Error updating pickup:", error);
    console.error("   Stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update pickup",
      error: error.message 
    });
  }
});

// -----------------------------
// 🚚 Assign pickup to agent (admin)
// -----------------------------
router.put("/:id/assign", authMiddleware, roleAuth("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🚚 Assigning pickup:", id);
    console.log("   req.io available?", typeof req.io !== 'undefined');
    
    const { deliveryAgentId, pickupTime } = req.body;

    if (!deliveryAgentId) {
      return res.status(400).json({ 
        success: false, 
        message: "Delivery agent ID is required" 
      });
    }

    const pickup = await Pickup.findById(id);
    if (!pickup) {
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }

    // ✅ Store userId BEFORE updating
    const userId = pickup.userId.toString();

    pickup.deliveryAgentId = deliveryAgentId;
    pickup.pickupTime = pickupTime ? new Date(pickupTime) : new Date();
    pickup.status = "assigned";
    await pickup.save();

    // ✅ Populate all relationships
    await pickup.populate("deliveryAgentId", "name email");
    await pickup.populate("userId", "name email");

    console.log("✅ Pickup assigned to agent:", deliveryAgentId);
    console.log("   Agent name:", pickup.deliveryAgentId?.name);

    // ✅ Emit socket events using req.io (NOT io directly)
    console.log("📡 Emitting assignment events...");
    
    emitSocketEvent(req, "pickup-assigned", {
      pickup,
      userId: userId,
      agentId: deliveryAgentId,
      timestamp: new Date()
    });

    emitSocketEvent(req, "pickup-assigned-user", {
      pickup,
      message: `Agent ${pickup.deliveryAgentId?.name || 'assigned'} will handle your pickup`,
      agentName: pickup.deliveryAgentId?.name
    }, userId);

    emitSocketEvent(req, "pickup-assigned-agent", {
      pickup,
      message: "You have been assigned a new pickup"
    }, deliveryAgentId);

    console.log("✅ Assignment events emitted successfully");

    res.json({ 
      success: true, 
      pickup,
      message: "Pickup assigned successfully"
    });
  } catch (error) {
    console.error("❌ Error assigning pickup:", error);
    console.error("   Stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Failed to assign pickup",
      error: error.message 
    });
  }
});

export default router;