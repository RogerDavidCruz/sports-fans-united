// backend/server.js
const express = require('express');
const http = require('http');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');

const app = express();

app.get('/db-ping', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    res.json(r.rows[0]);
  } catch (e) {
    console.error('DB ping failed:', e);
    res.status(500).json({ error: e.message, code: e.code });
  }
});

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

// REST (users)
app.use('/api/users', userRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------- Socket.IO + Rooms ----------------
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], methods: ['GET','POST'] },
});

// In-memory stores (demo)
const rooms = new Map();       // id -> { id, name, createdAt, expiresAt, messages:[], participants: Map<userId, {id,name}>, history: Map<userId,{id,name,joinedAt}> }
const pastRooms = new Map();   // expired archives: id -> { ... , expiredAt, participantsHistory: [{id,name}] }
const userRoomHistory = new Map(); // userId -> [{ roomId, name, joinedAt, expiredAt? }]

// helpers
const now = () => Date.now();
const NINETY_MIN = 90 * 60 * 1000;

function makeId(name = 'fan-room') {
  const slug = name.trim().replace(/\s+/g, '-').toLowerCase() || 'fan-room';
  const rnd = Math.random().toString(36).slice(2, 7);
  return `${slug}-${rnd}`;
}

function createRoom(name) {
  const id = makeId(name);
  const createdAt = now();
  const room = {
    id,
    name,
    createdAt,
    expiresAt: createdAt + NINETY_MIN,
    messages: [],
    participants: new Map(),
    history: new Map(), // who ever joined
  };
  rooms.set(id, room);
  return room;
}

function isExpired(room) {
  return now() >= room.expiresAt;
}

function archiveRoom(id) {
  const room = rooms.get(id);
  if (!room) return;
  const participantsHistory = Array.from(room.history.values());
  pastRooms.set(id, {
    id: room.id,
    name: room.name,
    createdAt: room.createdAt,
    expiredAt: now(),
    participantsHistory,
  });
  rooms.delete(id);
}

// cleanup every minute
setInterval(() => {
  for (const [id, r] of rooms) {
    if (isExpired(r)) {
      archiveRoom(id);
    }
  }
  // broadcast room list updates
  io.emit('rooms_updated');
}, 60 * 1000);

// ---------------- REST for Rooms ----------------

// Live rooms (not expired)
app.get('/api/rooms', (_req, res) => {
  const live = [];
  for (const r of rooms.values()) {
    if (!isExpired(r)) {
      live.push({
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        participantCount: r.participants.size,
      });
    }
  }
  live.sort((a, b) => b.createdAt - a.createdAt);
  res.json(live);
});

// Create a room explicitly
app.post('/api/rooms', (req, res) => {
  const { name } = req.body || {};
  const room = createRoom(name || 'fan room');
  io.emit('rooms_updated');
  res.status(201).json({
    id: room.id,
    name: room.name,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
  });
});

// Room detail (live or past)
app.get('/api/rooms/:id', (req, res) => {
  const id = req.params.id;
  const live = rooms.get(id);
  if (live && !isExpired(live)) {
    return res.json({
      id: live.id,
      name: live.name,
      createdAt: live.createdAt,
      expiresAt: live.expiresAt,
      participants: Array.from(live.participants.values()),
    });
  }
  const past = pastRooms.get(id);
  if (past) return res.json(past);
  res.status(404).json({ error: 'Room not found' });
});

// User room history (live + past)
app.get('/api/users/:id/rooms', (req, res) => {
  const uid = String(req.params.id);
  const hist = userRoomHistory.get(uid) || [];
  // enrich with participants (from live or past)
  const enriched = hist.map((h) => {
    const live = rooms.get(h.roomId);
    const past = pastRooms.get(h.roomId);
    const participants =
      live
        ? Array.from(live.history.values())
        : past?.participantsHistory || [];
    const expiredAt = past?.expiredAt || (live && isExpired(live) ? now() : undefined);
    return { ...h, participants, expiredAt };
  });
  // newest first
  enriched.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
  res.json(enriched);
});

// ---------------- Socket events ----------------
io.on('connection', (socket) => {
  // for disconnect cleanup
  socket.data.roomId = null;
  socket.data.userId = null;

  socket.on('join_room', ({ roomId, userId, user: userName }) => {
    if (!roomId) return;

    // Create room on first join if it doesn't exist, or revive if expired (create anew)
    let room = rooms.get(roomId);
    if (!room) {
      // if a POST created it earlier, we already have it; otherwise, create a fresh one with roomId as name
      room = createRoom(roomId.replace(/-[a-z0-9]{5}$/, ''));
      // ensure id matches requested
      room.id = roomId;
      rooms.set(roomId, room);
    }
    if (isExpired(room)) {
      // expire immediately and tell client
      archiveRoom(roomId);
      socket.emit('room_expired');
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId || `guest-${socket.id}`;

    // track participants (current)
    const participant = { id: String(socket.data.userId), name: userName || 'Guest' };
    room.participants.set(participant.id, participant);

    // track room-level history
    room.history.set(participant.id, participant);

    // track user history
    const list = userRoomHistory.get(participant.id) || [];
    list.push({ roomId: room.id, name: room.name, joinedAt: now() });
    userRoomHistory.set(participant.id, list);

    // send history & participants
    socket.emit('history', room.messages || []);
    io.to(roomId).emit('participants', Array.from(room.participants.values()));
    io.emit('rooms_updated');
  });

  socket.on('chat_message', ({ roomId, user, text }) => {
    const room = rooms.get(roomId);
    if (!room || isExpired(room) || !text) return;
    const msg = { user, text, ts: now() };
    room.messages.push(msg);
    io.to(roomId).emit('chat_message', msg);
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const uid = socket.data.userId;
    if (!roomId || !uid) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.participants.delete(String(uid));
    io.to(roomId).emit('participants', Array.from(room.participants.values()));
    io.emit('rooms_updated');
  });
});

const PORT = process.env.PORT || 5001;
const pool = require('./config/db');
app.get('/db-ping', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    res.json(r.rows[0]);
  } catch (e) {
    console.error('DB ping failed:', e);
    res.status(500).json({ error: e.message, code: e.code });
  }
});

server.listen(PORT, () => console.log(`API & Socket listening on ${PORT}`));
