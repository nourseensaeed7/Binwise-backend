import userModel from "../models/userModel.js"; // ✅ FIXED: Changed from User to userModel

const DAILY_GOAL = 5;
const POINTS_REWARD = 25; // reward for completing daily goal

export const updateDailyProgress = async (req, res) => {
  try {
    // ✅ FIXED: Changed from req.user._id to req.userId (matches authMiddleware)
    const user = await userModel.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const today = new Date().toDateString();
    const lastDate = user.lastProgressDate
      ? new Date(user.lastProgressDate).toDateString()
      : null;

    // 🗓 If it's a new day → reset progress
    if (today !== lastDate) {
      user.dailyProgress = 0;
    }

    // ➕ Add progress
    user.dailyProgress = (user.dailyProgress || 0) + 1;
    user.lastProgressDate = new Date();

    let redeemed = false;

    // 🎉 Goal reached → redeem
    if (user.dailyProgress >= DAILY_GOAL) {
      user.points = (user.points || 0) + POINTS_REWARD;
      user.dailyProgress = 0; // reset progress
      redeemed = true;
    }

    await user.save();

    console.log(`✅ Progress updated for user ${user.name}`);
    console.log(`   - Daily Progress: ${user.dailyProgress}/${DAILY_GOAL}`);
    console.log(`   - Redeemed: ${redeemed}`);
    console.log(`   - Total Points: ${user.points}`);

    res.json({
      success: true,
      redeemed,
      dailyProgress: user.dailyProgress,
      dailyGoal: DAILY_GOAL,
      updatedPoints: user.points,
      pointsAwarded: redeemed ? POINTS_REWARD : 0,
    });
  } catch (error) {
    console.error("❌ Progress update error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: error.message 
    });
  }
};