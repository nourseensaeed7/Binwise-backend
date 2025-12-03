import mongoose from "mongoose";

const centerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    contact: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    operatingHours: {
      type: String,
      default: "9:00 AM - 5:00 PM",
    },
    acceptedMaterials: {
      type: [String],
      default: ["Plastic", "Paper", "Metal", "Glass", "E-Waste"],
    },
    capacity: {
      type: Number,
      default: 1000, // in kg
    },
    currentLoad: {
      type: Number,
      default: 0, // in kg
    },
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active",
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    coordinates: {
      lat: {
        type: Number,
      },
      lng: {
        type: Number,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Center = mongoose.model("Center", centerSchema);

export default Center;
