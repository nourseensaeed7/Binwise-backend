import Center from "../models/centerModel.js";

/* =====================================================
   GET ALL CENTERS
===================================================== */
export const getAllCenters = async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const centers = await Center.find(query).sort({ createdAt: -1 });

    console.log(`📍 Found ${centers.length} centers`);
    
    return res.json({
      success: true,
      count: centers.length,
      centers,
    });
  } catch (error) {
    console.error("Error fetching centers:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =====================================================
   GET CENTER BY ID
===================================================== */
export const getCenterById = async (req, res) => {
  try {
    const { id } = req.params;

    const center = await Center.findById(id);

    if (!center) {
      return res.status(404).json({ success: false, message: "Center not found" });
    }

    return res.json({
      success: true,
      center,
    });
  } catch (error) {
    console.error("Error fetching center:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =====================================================
   CREATE CENTER (Admin Only)
===================================================== */
export const createCenter = async (req, res) => {
  try {
    const {
      name,
      location,
      contact,
      address,
      operatingHours,
      acceptedMaterials,
      capacity,
      coordinates,
    } = req.body;

    // Validation
    if (!name || !location || !contact) {
      return res.status(400).json({
        success: false,
        message: "Name, location, and contact are required",
      });
    }

    // Check if center already exists
    const existingCenter = await Center.findOne({ name, location });
    if (existingCenter) {
      return res.status(400).json({
        success: false,
        message: "Center with this name and location already exists",
      });
    }

    const center = await Center.create({
      name,
      location,
      contact,
      address,
      operatingHours,
      acceptedMaterials,
      capacity,
      coordinates,
    });

    console.log("✅ Center created:", center._id);

    return res.status(201).json({
      success: true,
      message: "Center created successfully",
      center,
    });
  } catch (error) {
    console.error("Error creating center:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =====================================================
   UPDATE CENTER (Admin Only)
===================================================== */
export const updateCenter = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const center = await Center.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!center) {
      return res.status(404).json({ success: false, message: "Center not found" });
    }

    console.log("✅ Center updated:", center._id);

    return res.json({
      success: true,
      message: "Center updated successfully",
      center,
    });
  } catch (error) {
    console.error("Error updating center:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =====================================================
   DELETE CENTER (Admin Only)
===================================================== */
export const deleteCenter = async (req, res) => {
  try {
    const { id } = req.params;

    const center = await Center.findByIdAndDelete(id);

    if (!center) {
      return res.status(404).json({ success: false, message: "Center not found" });
    }

    console.log("✅ Center deleted:", center._id);

    return res.json({
      success: true,
      message: "Center deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting center:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =====================================================
   GET NEARBY CENTERS (Based on location)
===================================================== */
export const getNearbyCenters = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // radius in km

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    // Simple distance calculation (you can use MongoDB geospatial queries for better results)
    const centers = await Center.find({ status: "active" });

    // Filter by distance (simple calculation)
    const nearbyCenters = centers.filter((center) => {
      if (!center.coordinates?.lat || !center.coordinates?.lng) return false;

      const distance = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        center.coordinates.lat,
        center.coordinates.lng
      );

      return distance <= parseFloat(radius);
    });

    return res.json({
      success: true,
      count: nearbyCenters.length,
      centers: nearbyCenters,
    });
  } catch (error) {
    console.error("Error fetching nearby centers:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Helper function to calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};