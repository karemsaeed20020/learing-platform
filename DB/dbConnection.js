import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      // ✅ Add these timeout options to prevent buffering timeout
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds  
      connectTimeoutMS: 30000, // 30 seconds
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Test the connection
    await mongoose.connection.db.admin().ping();
    console.log('🎯 MongoDB ping successful');
    
  } catch (err) {
    console.error("❌ Error connecting to MongoDB:", err);
    console.log("🔧 Connection details:", {
      url: process.env.MONGO_URL ? "URL exists" : "URL missing",
      database: process.env.MONGO_URL?.split('/')?.pop()?.split('?')[0] || "Unknown"
    });
    
    // Exit process with failure
    process.exit(1);
  }
};

// MongoDB connection events for better debugging
mongoose.connection.on('connected', () => {
  console.log('🎯 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected from MongoDB');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed due to app termination');
  process.exit(0);
});

export default connectDB;
