import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js";
import {
  EMAIL_VERIFY_TEMPLATE,
  PASSWORD_RESET_TEMPLATE,
} from "../config/emailTemplates.js";

/* =====================================================
   REGISTER USER
===================================================== */
export const register = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    email = email.toLowerCase();

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new userModel({
      name,
      email,
      password: hashedPassword,
      role: role || "user",
      isAccountVerified: role === "admin" ? true : false,
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      userData: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        badges: user.badges,
        isAccountVerified: user.isAccountVerified,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
};

/* =====================================================
   LOGIN USER
===================================================== */
export const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Email and password required" });

    email = email.toLowerCase();

    const user = await userModel.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: "Invalid email" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res
        .status(401)
        .json({ success: false, message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      success: true,
      message: "Login successful",
      token,
      userData: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        badges: user.badges,
        isAccountVerified: user.isAccountVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
};

/* =====================================================
   LOGOUT
===================================================== */
export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Logout failed" });
  }
};

/* =====================================================
   SEND EMAIL VERIFY OTP
===================================================== */
export const sendVerifyOtp = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 15 * 60 * 1000;
    await user.save();

    const emailHtml = EMAIL_VERIFY_TEMPLATE.replace("{OTP}", otp);

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Verify Your Email",
      html: emailHtml,
    });

    return res.json({
      success: true,
      message: "OTP sent to your email successfully",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error sending OTP email" });
  }
};

/* =====================================================
   VERIFY EMAIL
===================================================== */
export const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp)
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });

    const user = await userModel.findById(req.userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    if (user.verifyOtp !== otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    if (user.verifyOtpExpireAt < Date.now())
      return res.status(400).json({ success: false, message: "OTP has expired" });

    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;
    await user.save();

    return res.json({
      success: true,
      message: "Email verified successfully!",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
};

/* =====================================================
   SEND RESET PASSWORD OTP
===================================================== */
export const sendResetOtp = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    email = email.toLowerCase();

    const user = await userModel.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;
    await user.save();

    const emailHtml = PASSWORD_RESET_TEMPLATE.replace("{OTP}", otp);

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Password Reset OTP",
      html: emailHtml,
    });

    return res.json({ success: true, message: "Reset OTP sent to your email" });
  } catch (error) {
    console.error("Send reset OTP error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
};

/* =====================================================
   RESET PASSWORD
===================================================== */
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });

    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (user.resetOtp !== otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    if (user.resetOtpExpireAt < Date.now())
      return res.status(400).json({ success: false, message: "OTP has expired" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
};

/* =====================================================
   CHECK AUTH STATUS
===================================================== */
export const isAuthenticated = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId).select("-password");
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      userData: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        badges: user.badges,
        isAccountVerified: user.isAccountVerified,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error, please try again" });
  }
};

/* =====================================================
   GET USER PROFILE
===================================================== */
export const getUserProfile = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      userData: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        points: user.points,
        daysRecycled: user.daysRecycled,
        badges: user.badges,
        stats: user.stats,
        activity: user.activity,
        isAccountVerified: user.isAccountVerified,
        address: user.address,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch profile data" });
  }
};

/* =====================================================
   UPDATE USER PROFILE
===================================================== */
export const updateProfile = async (req, res) => {
  try {
    const { name, email, address, level } = req.body;
    const profileImage = req.file;

    console.log("Address:", address);
    console.log("File uploaded:", req.file ? req.file.filename : "No file");

    const user = await userModel.findById(req.userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (address) user.address = address;
    if (level) user.level = level;
    if (profileImage) user.profileImage = `/uploads/${profileImage.filename}`;
    if(req.file) user.profileImage = `/uploads/${req.file.filename}`;

    await user.save();

    return res.json({
      success: true,
      message: "Profile updated successfully",
      userData: {
        id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        profileImage: user.profileImage,
        level: user.level,
        points: user.points,
        daysRecycled: user.daysRecycled,
        badges: user.badges,
        stats: user.stats,
        activity: user.activity,
        isAccountVerified: user.isAccountVerified,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update profile" });
  }
};

/* =====================================================
   ADD RECYCLING ACTIVITY
===================================================== */
export const addActivity = async (req, res) => {
  try {
    const { action, Points } = req.body;

    if (!action || !Points) {
      return res
        .status(400)
        .json({ success: false, message: "Action and Points are required" });
    }

    const user = await userModel.findById(req.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const newActivity = {
      action,
      date: new Date(),
      Points: Number(Points),
    };

    user.activity.unshift(newActivity);
    user.points += Number(Points);
    user.daysRecycled += 1;

    await user.save();

    return res.json({
      success: true,
      message: "Activity added successfully",
      activity: newActivity,
    });
  } catch (error) {
    console.error("Add activity error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add activity" });
  }
};




