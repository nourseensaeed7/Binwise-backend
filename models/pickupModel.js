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
