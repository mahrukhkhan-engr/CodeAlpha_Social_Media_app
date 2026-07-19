const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 
const pool = require('./db'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Middlewares
app.use(cors());
app.use(express.json()); 

// Centralized Routes
const apiRoutes = require('./backend/routes');
app.use('/api', apiRoutes); 

// Simple Test Route
app.get('/', (req, res) => {
  res.send('Server is running smoothly!');
});

// Real-Time Chat Socket.io
io.on('connection', (socket) => {
  console.log(`🔌 A user connected: ${socket.id}`);

  socket.on('join_room', (conversation_id) => {
    socket.join(conversation_id);
    console.log(`👤 User joined room: ${conversation_id}`);
  });

  socket.on('send_live_message', (data) => {
    socket.to(data.conversation_id).emit('receive_live_message', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });

  socket.on('delete_live_message', (data) => {
    socket.to(data.conversation_id).emit('receive_deleted_message', data);
  });
});

// ==========================================
// 🛡️ GLOBAL JSON ERROR HANDLER (PERMANENT NOT-VALID-JSON PREVENTER)
// ==========================================
app.use((err, req, res, next) => {
  console.error("🔥 Global Server Error Captured:", err);
  res.status(err.status || 500).json({ 
    error: err.message || "An unexpected database/server error occurred." 
  });
});

// Server listen setup
server.listen(PORT, () => {
  console.log(` Server is flying on port ${PORT}`);
});