import mongoose from "mongoose";

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log("✅ MongoDB already connected");
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URL, {
      dbName: "blogData",
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host} / ${conn.connection.name}`);
    
    // Only log collections in development
    if (process.env.NODE_ENV !== 'production') {
      const collections = await conn.connection.db.listCollections().toArray();
      console.log("📂 Collections in blogData:", collections.map(c => c.name));
    }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};

export default connectDB;