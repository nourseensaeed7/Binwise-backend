import User from "../models/userModel.js";

const DAILY_GOAL = 5;
const POINTS_REWARD = 25; // reward for completing daily goal

export const updateDailyProgress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id); // logged-in user

    const today = new Date().toDateString();
    const lastDate = user.lastProgressDate
      ? new Date(user.lastProgressDate).toDateString()
      : null;

    // 🗓 If it's a new day → reset progress
    if (today !== lastDate) {
      user.dailyProgress = 0;
    }

    // ➕ Add progress
    user.dailyProgress += 1;
    user.lastProgressDate = new Date();

    let redeemed = false;

    // 🎉 Goal reached → redeem
    if (user.dailyProgress >= DAILY_GOAL) {
      user.points += POINTS_REWARD;
      user.dailyProgress = 0; // reset progress
      redeemed = true;
    }

    await user.save();

    res.json({
      success: true,
      redeemed,
      dailyProgress: user.dailyProgress,
      updatedPoints: user.points,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
