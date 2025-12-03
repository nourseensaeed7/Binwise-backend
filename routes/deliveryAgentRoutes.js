// routes/deliveryAgentRoutes.js
import express from "express";
import {
  createAgent,
  getAllAgents,
  updateAgent,
  deleteAgent,
} from "../controllers/deliveryAgentController.js";

const router = express.Router();

router.post("/", createAgent);     // Create new agent
router.get("/", getAllAgents);     // List all agents
router.put("/:id", updateAgent);   // Update agent info
router.delete("/:id", deleteAgent); // Delete agent

export default router;
