import express from "express";
import Pickup from "../models/pickupModel.js";
import userModel from "../models/userModel.js";
import authMiddleware from "../middleware/authMiddleware.js";
import roleAuth from "../middleware/roleAuth.js";

const router = express.Router();

// -----------------------------
// 🎯 Helper Functions
// -----------------------------

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

const calculatePointsAndDistributeWeight = (items, totalWeight) => {
  const totalItemWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  const hasItemWeights = totalItemWeight > 0;

  let processedItems = [...items];

  if (!hasItemWeights && totalWeight > 0) {
    const weightPerItem = totalWeight / items.length;
    processedItems = items.map(item => ({ ...item, weight: weightPerItem }));
  }

  const totalPoints = processedItems.reduce((acc, item) => {
    const perKg = POINTS_PER_KG[item.type] || 0;
    return acc + perKg * (item.weight || 0);
  }, 0);

  return {
    processedItems,
    totalPoints: Math.round(totalPoints),
  };
};

const calculateGains = (points) => parseFloat((points * 0.15).toFixed(2));

// Safe socket emission helper
const emitSocketEvent = (req, eventName, data, userId = null) => {
  try {
    if (!req.io) {
      console.log(`⚠️ Socket.io not available for event: ${eventName}`);
      return false;
    }

    req.io.emit(eventName, data);

    if (userId) {
      req.io.to(`user:${userId}`).emit(eventName, data);
      console.log(`📡 Socket event emitted to user ${userId}: ${eventName}`);
    } else {
      console.log(`📡 Socket event emitted globally: ${eventName}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error emitting socket event ${eventName}:`, error.message);
    return false;
  }
};

// -----------------------------
// 🧾 Routes
// -----------------------------

// Admin: Get all pickups
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

// User: Get own pickups
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const pickups = await Pickup.find({ userId: req.userId })
      .populate("deliveryAgentId", "name email role")
      .sort({ createdAt: -1 });

    res.json({ success: true, pickups });
  } catch (error) {
    console.error("❌ Error fetching user pickups:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create pickup
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { items, address, pickupTime, time_slot, weight, instructions } = req.body;

    if (!address || !items || !weight || !pickupTime || !time_slot || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Missing or invalid fields" });
    }

    const { processedItems, totalPoints } = calculatePointsAndDistributeWeight(items, weight);
    const totalGains = calculateGains(totalPoints);

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

    await pickup.populate("userId", "name email");

    await userModel.findByIdAndUpdate(req.userId, {
      $push: { activity: { action: `Created pickup request - ${totalPoints} points pending`, points: 0, gains: 0, date: new Date() } },
    });

    emitSocketEvent(req, "new-pickup", { pickup, userId: req.userId });
    emitSocketEvent(req, "pickup-created", { pickup, message: "Pickup request created" }, req.userId);

    res.status(201).json({ success: true, pickup, awardedPoints: totalPoints, gains: totalGains });
  } catch (error) {
    console.error("❌ Error creating pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Complete pickup (admin or assigned agent)
router.put("/:id/complete", authMiddleware, async (req, res) => {
  try {
    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) return res.status(404).json({ success: false, message: "Pickup not found" });
    if (req.userRole !== "admin" && pickup.deliveryAgentId?.toString() !== req.userId) return res.status(403).json({ success: false, message: "Not authorized" });
    if (pickup.status === "completed") return res.status(400).json({ success: false, message: "Already completed" });

    const { totalPoints } = calculatePointsAndDistributeWeight(pickup.items, pickup.weight);
    const totalGains = calculateGains(totalPoints);

    pickup.status = "completed";
    pickup.awardedPoints = totalPoints;
    pickup.gains = totalGains;
    await pickup.save();

    const updatedUser = await userModel.findByIdAndUpdate(
      pickup.userId,
      { $inc: { points: totalPoints, gains: totalGains, daysRecycled: 1 }, $push: { activity: { action: `Pickup completed - ${totalPoints} points (${totalGains} EGP)`, points: totalPoints, gains: totalGains, date: new Date() } } },
      { new: true }
    ).select("points gains activity");

    await pickup.populate("userId", "name email");
    await pickup.populate("deliveryAgentId", "name email");

    emitSocketEvent(req, "pickup-completed", { pickup, userId: pickup.userId._id });
    emitSocketEvent(req, "points-awarded", { points: totalPoints, gains: totalGains, totalPoints: updatedUser.points, totalGains: updatedUser.gains }, pickup.userId._id.toString());

    res.json({ success: true, pickup, awardedPoints: totalPoints, gains: totalGains, user: { points: updatedUser.points, gains: updatedUser.gains, latestActivity: updatedUser.activity.slice(-1)[0] } });
  } catch (error) {
    console.error("❌ Error completing pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete pickup
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) return res.status(404).json({ success: false, message: "Pickup not found" });
    if (req.userRole !== "admin" && pickup.userId.toString() !== req.userId) return res.status(403).json({ success: false, message: "Not authorized" });
    if (pickup.status === "completed") return res.status(400).json({ success: false, message: "Cannot delete completed pickups" });

    await Pickup.findByIdAndDelete(req.params.id);
    await userModel.findByIdAndUpdate(pickup.userId, { $push: { activity: { action: "Pickup request cancelled", points: 0, gains: 0, date: new Date() } } });

    emitSocketEvent(req, "pickup-deleted", { pickupId: req.params.id, userId: pickup.userId });

    res.json({ success: true, message: "Pickup deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update pickup (user)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) return res.status(404).json({ success: false, message: "Pickup not found" });
    if (req.userRole !== "admin" && pickup.userId.toString() !== req.userId) return res.status(403).json({ success: false, message: "Not authorized" });
    if (pickup.status !== "pending") return res.status(400).json({ success: false, message: "Only pending pickups can be updated" });

    const { address, items, weight, instructions, pickupTime, time_slot } = req.body;

    if (address) pickup.address = address;
    if (instructions !== undefined) pickup.instructions = instructions;
    if (pickupTime) pickup.pickupTime = new Date(pickupTime);
    if (time_slot) pickup.time_slot = time_slot;

    if (items || weight) {
      const updatedItems = items || pickup.items;
      const updatedWeight = weight || pickup.weight;
      const { processedItems, totalPoints } = calculatePointsAndDistributeWeight(updatedItems, updatedWeight);
      pickup.items = processedItems;
      pickup.weight = updatedWeight;
      pickup.awardedPoints = totalPoints;
      pickup.gains = calculateGains(totalPoints);
    }

    await pickup.save();
    emitSocketEvent(req, "pickup-updated", { pickup, userId: pickup.userId });

    res.json({ success: true, pickup, message: "Pickup updated successfully", awardedPoints: pickup.awardedPoints, gains: pickup.gains });
  } catch (error) {
    console.error("❌ Error updating pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign pickup to agent (admin)
router.put("/:id/assign", authMiddleware, roleAuth("admin"), async (req, res) => {
  try {
    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) return res.status(404).json({ success: false, message: "Pickup not found" });

    const { deliveryAgentId, pickupTime } = req.body;
    pickup.deliveryAgentId = deliveryAgentId;
    pickup.pickupTime = pickupTime ? new Date(pickupTime) : new Date();
    pickup.status = "assigned";

    await pickup.save();
    await pickup.populate("deliveryAgentId", "name email");

    emitSocketEvent(req, "pickup-assigned", { pickup, userId: pickup.userId, agentId: deliveryAgentId });

    res.json({ success: true, pickup });
  } catch (error) {
    console.error("❌ Error assigning pickup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
