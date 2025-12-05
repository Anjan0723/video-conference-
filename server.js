const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store rooms and participants
const rooms = new Map();

// REST API endpoints
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    name: room.name,
    participants: room.participants.length,
    createdAt: room.createdAt
  }));
  res.json(roomList);
});

app.post('/api/rooms', (req, res) => {
  const { name } = req.body;
  const roomId = Math.random().toString(36).substring(2, 9);
  
  rooms.set(roomId, {
    id: roomId,
    name: name || `Room ${roomId}`,
    participants: [],
    createdAt: new Date()
  });
  
  res.json({ roomId, name: rooms.get(roomId).name });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json(room);
});

// WebRTC signaling via Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        name: `Room ${roomId}`,
        participants: [],
        createdAt: new Date()
      });
    }
    
    const room = rooms.get(roomId);
    const participant = {
      id: socket.id,
      name: userName || `User ${socket.id.substring(0, 4)}`
    };
    
    room.participants.push(participant);
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', participant);
    
    // Send current participants to the new user
    socket.emit('room-users', room.participants.filter(p => p.id !== socket.id));
    
    console.log(`${userName} joined room ${roomId}`);
  });

  socket.on('offer', ({ offer, to, from }) => {
    io.to(to).emit('offer', { offer, from });
  });

  socket.on('answer', ({ answer, to, from }) => {
    io.to(to).emit('answer', { answer, from });
  });

  socket.on('ice-candidate', ({ candidate, to, from }) => {
    io.to(to).emit('ice-candidate', { candidate, from });
  });

  socket.on('toggle-audio', ({ roomId, userId, enabled }) => {
    socket.to(roomId).emit('user-audio-toggle', { userId, enabled });
  });

  socket.on('toggle-video', ({ roomId, userId, enabled }) => {
    socket.to(roomId).emit('user-video-toggle', { userId, enabled });
  });

  socket.on('chat-message', ({ roomId, message, userName }) => {
    io.to(roomId).emit('chat-message', {
      message,
      userName,
      userId: socket.id,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from all rooms
    rooms.forEach((room, roomId) => {
      const index = room.participants.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        const participant = room.participants[index];
        room.participants.splice(index, 1);
        
        // Notify others
        io.to(roomId).emit('user-left', { userId: socket.id, userName: participant.name });
        
        // Delete room if empty
        if (room.participants.length === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});