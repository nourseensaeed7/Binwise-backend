import Pickup from "../models/pickupModel.js";
import User from "../models/userModel.js";

const DAILY_GOAL = 5;
const POINTS_REWARD = 25;

/**
 * GET /api/pickups
 * Fetch all pickups (Admin only)
 */
export const getAllPickups = async (req, res) => {
  try {
    const pickups = await Pickup.find()
      .populate("userId", "name email")
      .populate("centerId", "name location")
      .populate("deliveryAgentId", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, pickups });
  } catch (error) {
    console.error("Error fetching pickups:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * PUT /api/pickups/:id
 * Update pickup (status or schedule)
 */
export const updatePickup = async (req, res) => {
  try {
    const { id } = req.params;
    const { pickup_status, scheduled_date, deliveryAgentId } = req.body;

    const updated = await Pickup.findByIdAndUpdate(
      id,
      { pickup_status, scheduled_date, deliveryAgentId },
      { new: true }
    )
      .populate("userId", "name email")
      .populate("centerId", "name location")
      .populate("deliveryAgentId", "name email");

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Pickup not found" });

    res.json({ success: true, pickup: updated });
  } catch (error) {
    console.error("Error updating pickup:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * PUT /api/pickups/:id/complete
 * Mark pickup as completed + update daily progress & redeem points
 */
export const completePickup = async (req, res) => {
  try {
    const { id } = req.params;

    const pickup = await Pickup.findById(id);
    if (!pickup)
      return res
        .status(404)
        .json({ success: false, message: "Pickup not found" });

    // 📌 Update pickup status
    pickup.pickup_status = "completed";
    pickup.awardedPoints = 5; // change to your logic
    await pickup.save();

    // 📌 Fetch user
    const user = await User.findById(pickup.userId);

    const today = new Date().toDateString();
    const lastDate = user.lastProgressDate
      ? new Date(user.lastProgressDate).toDateString()
      : null;

    // 📌 Reset progress if a new day
    if (today !== lastDate) {
      user.dailyProgress = 0;
    }

    // ➕ Add progress
    user.dailyProgress += 1;
    user.lastProgressDate = new Date();

    let redeemed = false;

    // 🎉 Check goal completion
    if (user.dailyProgress >= DAILY_GOAL) {
      user.points += POINTS_REWARD;
      user.dailyProgress = 0; // reset after redeem
      redeemed = true;
    }

    await user.save();

    res.json({
      success: true,
      message: "Pickup completed successfully",
      progress: {
        dailyProgress: user.dailyProgress,
        redeemed,
        updatedPoints: user.points,
      },
    });
  } catch (error) {
    console.error("Error completing pickup:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// import Pickup from "../models/Pickup.js";

// /**
//  * GET /api/pickups
//  * Fetch all pickups (Admin only)
//  */
// export const getAllPickups = async (req, res) => {
//   try {
//     const pickups = await Pickup.find()
//       .populate("userId", "name email")
//       .populate("centerId", "name location")
//       .populate("deliveryAgentId", "name email") // ✅ populate agent
//       .sort({ createdAt: -1 });

//     res.json({ success: true, pickups });
//   } catch (error) {
//     console.error("Error fetching pickups:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// /**
//  * PUT /api/pickups/:id
//  * Update pickup (status or schedule)
//  */
// export const updatePickup = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { pickup_status, scheduled_date, deliveryAgentId } = req.body;

//     const updated = await Pickup.findByIdAndUpdate(
//       id,
//       { pickup_status, scheduled_date, deliveryAgentId },
//       { new: true }
//     )
//       .populate("userId", "name email")
//       .populate("centerId", "name location")
//       .populate("deliveryAgentId", "name email"); // ✅ populate agent

//     if (!updated)
//       return res
//         .status(404)
//         .json({ success: false, message: "Pickup not found" });

//     res.json({ success: true, pickup: updated });
//   } catch (error) {
//     console.error("Error updating pickup:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };
