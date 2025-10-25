import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import appRouter from './src/app.router.js';
import connectDB from './DB/dbConnection.js';

dotenv.config();

const app = express();
const server = createServer(app);

// ✅ PRODUCTION CORS CONFIGURATION
const allowedOrigins = [
  'https://elaby-platform-6ytr.vercel.app',
  'https://elaby-ewlr.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie']
}));

// ✅ Remove any app.options('*', cors()) lines

// ✅ Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ CRITICAL: Increase server timeout
server.timeout = 30 * 60 * 1000;
server.headersTimeout = 30 * 60 * 1000;
server.keepAliveTimeout = 30 * 60 * 1000;

// ✅ Basic routes
app.get("/", (req, res) => {
  res.json({ 
    message: "Backend is working!",
    environment: process.env.NODE_ENV
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is healthy",
    timestamp: new Date().toISOString()
  });
});

// Socket.io configuration
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", 'PUT', 'DELETE']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Your socket.io logic...
const connectedUsers = new Map();

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

// ✅ Global timeout middleware
app.use((req, res, next) => {
  req.setTimeout(30 * 60 * 1000);
  res.setTimeout(30 * 60 * 1000);
  next();
});

// ✅ Import and use your appRouter
appRouter(app, express, io);

// ✅ CORRECT 404 handler (without wildcard *)
app.use((req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} not found`
  });
});

// ✅ Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Error:', error);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// Connect to database and start server
connectDB();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ CORS enabled for:`, allowedOrigins);
});
