import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import appRouter from './src/app.router.js';
import connectDB from './DB/dbConnection.js';

dotenv.config();

const app = express();
const server = createServer(app);

// ✅ CRITICAL: Increase server timeout for large file uploads
server.timeout = 30 * 60 * 1000; // 30 minutes
server.headersTimeout = 30 * 60 * 1000; // 30 minutes
server.keepAliveTimeout = 30 * 60 * 1000; // 30 minutes
app.get("/", (req, res) => {
  res.json({ message: "Backend is working!" });
});

// إعداد Socket.io
const io = new Server(server, {
  cors: {
    origin: [
    "https://elaby-ewlr.vercel.app/",    
    "http://localhost:3000",  
    ] ,

    methods: ["GET", "POST", 'PUT', 'DELETE'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// تخزين المستخدمين المتصلين
const connectedUsers = new Map();

// التعامل مع اتصالات Socket
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} joined with socket ${socket.id}`);
  });

  socket.on('sendMessage', (data) => {
    const { receiverId, message } = data;
    const receiverSocketId = connectedUsers.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('newMessage', message);
    }
  });

  socket.on('disconnect', () => {
    for (let [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// ✅ CRITICAL: Global timeout middleware for all routes
app.use((req, res, next) => {
  req.setTimeout(30 * 60 * 1000); // 30 minutes
  res.setTimeout(30 * 60 * 1000); // 30 minutes
  next();
});

// ✅ Specific timeout for upload routes
app.use('/api/videos/upload', (req, res, next) => {
  req.setTimeout(30 * 60 * 1000);
  res.setTimeout(30 * 60 * 1000);
  next();
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// تمرير io إلى appRouter
appRouter(app, express, io);

connectDB();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Server timeout set to: ${server.timeout}ms`);
});