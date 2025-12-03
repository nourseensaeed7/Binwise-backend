import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import connectDB from "./config/mongodb.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routes
import authRouter from "./routes/authRoutes.js";
import postsRouter from "./routes/postsRoutes.js";
import usersRouter from "./routes/userRoutes.js";
import pickupRoutes from "./routes/pickupRoutes.js";
import deliveryAgentRoutes from "./routes/deliveryAgentRoutes.js";
import centersRoutes from "./routes/centersRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";

dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS - Add your Railway URL after deployment
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://bin-wise-recycle.vercel.app",
  "https://bin-wise-recycle-7s1bdhcsn-nourseens-projects.vercel.app",
  "https://bin-wise-recycle-git-main-nourseens-projects.vercel.app",
  "https://backend-production-ec018.up.railway.app"
];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log('🔍 Incoming request from origin:', origin);
      
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        console.log('✅ Origin allowed:', origin);
        callback(null, true);
      } else {
        console.log('❌ Origin BLOCKED:', origin);
        console.log('📋 Allowed origins:', allowedOrigins);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Connect to MongoDB
connectDB();

// Create HTTP server & Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  // ✅ Add ping settings for better connection stability
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ✅ Track connected users
const connectedUsers = new Map(); // userId -> socketId

// Socket.IO connection handling with user rooms
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  // ✅ Handle user authentication and room joining
  socket.on("authenticate", (userId) => {
    if (userId) {
      // Join user-specific room
      socket.join(`user:${userId}`);
      connectedUsers.set(userId, socket.id);
      console.log(`👤 User ${userId} authenticated and joined room user:${userId}`);
      
      // Send confirmation
      socket.emit("authenticated", { 
        success: true, 
        userId,
        message: "Successfully connected to real-time updates"
      });
    }
  });

  // ✅ Handle manual room joining (alternative method)
  socket.on("join-user-room", (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`👤 User ${userId} joined room user:${userId}`);
    }
  });

  // ✅ Handle disconnection
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    
    // Remove from connected users
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`👤 User ${userId} disconnected`);
        break;
      }
    }
  });

  // ✅ Handle reconnection
  socket.on("reconnect", (attemptNumber) => {
    console.log(`🔄 Client reconnected after ${attemptNumber} attempts:`, socket.id);
  });

  // ✅ Handle ping/pong for connection health
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: Date.now() });
  });
});

// CRITICAL: Make io available to ALL routes as middleware
app.use((req, res, next) => {
  req.io = io;
  req.connectedUsers = connectedUsers; // Also pass connected users map
  next();
});

console.log("📡 Socket.io middleware initialized");

// API Routes (MUST come AFTER io middleware)
app.use("/api/auth", authRouter);
app.use("/api/posts", postsRouter);
app.use("/api/users", usersRouter);
app.use("/api/pickups", pickupRoutes);
app.use("/api/delivery-agents", deliveryAgentRoutes);
app.use("/api/centers", centersRoutes);
app.use("/api/progress", progressRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({ 
    message: "BinWise Backend API is running ✅",
    status: "healthy",
    socketIo: "enabled",
    connectedClients: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok",
    socketIo: typeof io !== 'undefined' ? "connected" : "disconnected",
    connectedClients: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

// ✅ Socket status endpoint for debugging
app.get("/api/socket-status", (req, res) => {
  res.json({
    success: true,
    connectedClients: io.engine.clientsCount,
    connectedUsers: Array.from(connectedUsers.keys()),
    timestamp: new Date().toISOString()
  });
});

// Start server - Railway will provide PORT
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Socket.io ready with user room support`);
});

// Export io for use in other files if needed
export { io };