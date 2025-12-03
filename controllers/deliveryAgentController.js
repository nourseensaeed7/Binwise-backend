import DeliveryAgent from "../models/DeliveryAgent.js";

export const createAgent = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const existing = await DeliveryAgent.findOne({ email });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Agent already exists" });

    const agent = await DeliveryAgent.create({ name, email, phone });
    res.json({ success: true, agent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllAgents = async (req, res) => {
  try {
    const agents = await DeliveryAgent.find();
    res.json({ success: true, agents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, available } = req.body;

    const updated = await DeliveryAgent.findByIdAndUpdate(
      id,
      { name, email, phone, available },
      { new: true }
    );

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Agent not found" });

    res.json({ success: true, agent: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;
    await DeliveryAgent.findByIdAndDelete(id);
    res.json({ success: true, message: "Agent deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
