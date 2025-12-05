// routes/testRoutes.js
// ✅ Create this file to test socket functionality

import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Test socket availability (no auth required)
router.get("/socket-check", (req, res) => {
  res.json({
    success: true,
    socketIo: {
      available: typeof req.io !== 'undefined',
      emitFunctionExists: typeof req.io?.emit === 'function',
      toFunctionExists: typeof req.io?.to === 'function',
      connectedClients: req.io?.engine?.clientsCount || 0,
    },
    timestamp: new Date().toISOString()
  });
});

// Test socket emission (requires auth)
router.post("/test-emit", authMiddleware, (req, res) => {
  const { eventName, message } = req.body;
  
  if (!eventName) {
    return res.status(400).json({
      success: false,
      message: "eventName is required"
    });
  }
  
  try {
    if (!req.io) {
      return res.status(500).json({
        success: false,
        message: "Socket.io not available"
      });
    }
    
    const testData = {
      message: message || "Test message",
      userId: req.userId,
      timestamp: new Date()
    };
    
    // Emit to user's room
    req.io.to(`user:${req.userId}`).emit(eventName, testData);
    
    // Also emit to admin room
    req.io.to("admin").emit(eventName, testData);
    
    res.json({
      success: true,
      message: "Socket event emitted successfully",
      event: eventName,
      data: testData,
      emittedTo: [`user:${req.userId}`, "admin"]
    });
  } catch (error) {
    console.error("❌ Test emit error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
});

// Test user room join
router.post("/join-room", authMiddleware, (req, res) => {
  try {
    if (!req.io) {
      return res.status(500).json({
        success: false,
        message: "Socket.io not available"
      });
    }
    
    // This simulates what happens when a user connects
    const userId = req.userId;
    
    res.json({
      success: true,
      message: "Room join simulation",
      userId: userId,
      room: `user:${userId}`,
      note: "Actual room joining happens via socket connection on client side"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

// ✅ To use these test routes, add to server.js:
// import testRoutes from "./routes/testRoutes.js";
// app.use("/api/test", testRoutes);