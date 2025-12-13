const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');
const conferenceRoutes = require('./routes/conference');
const emailService = require('./services/email');
const { checkScheduledConferences } = require('./services/scheduler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Initialize database
initDatabase();

// Routes
app.use('/api/conference', conferenceRoutes);

// WebRTC signaling with Socket.io
const rooms = new Map(); // roomId -> Set of socketIds

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId, userName) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userName = userName;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userName: userName
    });

    // Send list of existing users to the new user
    const existingUsers = Array.from(rooms.get(roomId))
      .filter(id => id !== socket.id)
      .map(id => {
        const existingSocket = io.sockets.sockets.get(id);
        return existingSocket ? {
          socketId: id,
          userName: existingSocket.data.userName
        } : null;
      })
      .filter(Boolean);

    socket.emit('existing-users', existingUsers);

    // Broadcast updated user list
    broadcastUserList(roomId);
  });

  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      sender: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  socket.on('chat-message', (data) => {
    io.to(data.roomId).emit('chat-message', {
      userName: socket.data.userName,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      socket.to(roomId).emit('user-left', socket.id);
      broadcastUserList(roomId);
      
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

function broadcastUserList(roomId) {
  const users = Array.from(rooms.get(roomId) || [])
    .map(id => {
      const socket = io.sockets.sockets.get(id);
      return socket ? {
        socketId: id,
        userName: socket.data.userName
      } : null;
    })
    .filter(Boolean);

  io.to(roomId).emit('user-list', users);
}

// Check scheduled conferences every minute
setInterval(checkScheduledConferences, 60000);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

