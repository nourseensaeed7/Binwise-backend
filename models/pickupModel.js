import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  type: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  weight: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  estimatedValue: { type: String, default: "" },
});

const pickupSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [itemSchema], // ✅ array of objects
    address: { type: String, required: true },
    weight: { type: Number, required: true },
    instructions: { type: String, default: "" },
    pickupTime: { type: Date, required: true },
    time_slot: { type: String, required: true },
    status: { type: String, enum: ["pending", "assigned", "completed"], default: "pending" },
    awardedPoints: { type: Number, default: 0 },
    deliveryAgentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    gains: { type: Number, default: 0 },

  },
  { timestamps: true }
);

export default mongoose.model("Pickup", pickupSchema);


// // models/Pickup.js
// import mongoose from "mongoose";

// const pickupSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     centerId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Center",
//     },
//     deliveryAgentId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "DeliveryAgent",
//     },
//     status: {
//       type: String,
//       enum: ["pending", "assigned", "completed"],
//       default: "pending",
//     },
//     pickupTime: {
//       type: Date,
//     },
//     items: [
//       {
//         type: { type: String, required: true },
//         quantity: { type: Number, default: 1 },
//         weight: { type: Number, default: 0 },
//         points: { type: Number, default: 0 },
//         estimatedValue: { type: String, default: "" }
//       }
//     ],
//     weight: {
//       type: Number,
//       required: true,
//     },
//     address: {
//       type: String,  
//       required: true,
//     },
//     instructions: {
//       type: String,
//       default: "",
//     },
//     time_slot: {
//       type: String,
//       required: true,
//     },
//   },
//   { timestamps: true }
// );

// export default mongoose.model("Pickup", pickupSchema);


// import mongoose from "mongoose";

// const itemSchema = new mongoose.Schema({
//   category: { type: String, required: true },
//   weight: { type: Number, required: true },
// });

// const pickupSchema = new mongoose.Schema(
//   {
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//     centerId: { type: mongoose.Schema.Types.ObjectId, ref: "Center", default: null },

//     userName: { type: String, required: true },
//     items: [itemSchema],
//     status: {
//       type: String,
//       enum: ["pending", "assigned", "completed"],
//       default: "pending",
//     },
//     deliveryAgentId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       default: null,
//     },
//     pickupTime: { type: Date, default: null },
//     awardedPoints: { type: Number, default: 0 },

//   },
//   { timestamps: true }
// );

// export default mongoose.model("Pickup", pickupSchema);
