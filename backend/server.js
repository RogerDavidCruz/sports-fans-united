// --------------------------------------------------------------------------------------
// Sports Fans United – API + Socket server
// --------------------------------------------------------------------------------------
// This file serves:
//   • REST for users (delegated to ./routes/userRoutes)
//   • REST for soccer games (free TheSportsDB v1) with favorite-team filtering
//   • Realtime chat rooms via Socket.IO (create/join/delete/archive)
//   • Lightweight server-side caching for games (15 min), keyed by (team, tz offset)
//
// Notes:
//   - We intentionally keep *soccer only* here to stay within free tiers and reduce rate-limits.
//   - The /api/games/live endpoint uses the CLIENT'S local date (via ?client_tz_offset) so
//     “today” is correct for the user regardless of server timezone.
//   - We query “today + tomorrow” across a curated league list, filter by favorite team first,
//     then fall back to all leagues to ensure a useful list (min=5 by default).
// --------------------------------------------------------------------------------------

const express = require('express');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// --------------------------------------------------------------------------------------
// DB (used by /db-ping and user routes)
// --------------------------------------------------------------------------------------
const pool = require('./config/db'); // <-- your pg pool config

// --------------------------------------------------------------------------------------
// Middleware
// --------------------------------------------------------------------------------------
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

// Quick DB sanity endpoint
app.get('/db-ping', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    res.json(r.rows[0]);
  } catch (e) {
    console.error('DB ping failed:', e);
    res.status(500).json({ error: e.message, code: e.code });
  }
});

// --------------------------------------------------------------------------------------
// Users REST (delegated)
// --------------------------------------------------------------------------------------
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// --------------------------------------------------------------------------------------
// Socket.IO setup (for chat rooms)
// --------------------------------------------------------------------------------------
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});



// --------------------------------------------------------------------------------------
// Shared helpers (used by games + rooms where needed)
// --------------------------------------------------------------------------------------

// --- Match status (soccer-only) ---------------------------------------------

/**
 * normalizeStatus
 * Maps various provider strings to: 'LIVE' | 'FINAL' | 'UPCOMING'
 * TheSportsDB free tier is inconsistent (often empty), so keep this tolerant.
 */
function normalizeStatus(s) {
  const x = String(s || '').toLowerCase();

  // Common "live" signals
  if (
    x.includes('live') ||
    x.includes('in play') ||
    x.includes('inplay') ||
    x.includes('in progress') ||
    x === 'ht' || x.includes('half')
  ) return 'LIVE';

  // Common "final" signals
  if (
    x.includes('final') ||
    x.includes('finished') ||
    x === 'ft' || x.includes('full') ||
    x.includes('ended')
  ) return 'FINAL';

  // Everything else (incl. postponed/abandoned) we surface as UPCOMING
  return 'UPCOMING';
}

/**
 * determineStatus (soccer-only)
 * 1) If provider status is decisive (LIVE/FINAL), use it.
 * 2) Otherwise infer:
 *    - LIVE if now is within [start, start + 2h45m]
 *    - UPCOMING if now < start
 *    - FINAL if now > start + 2h45m
 */
function determineStatus(startIso, providerStatus) {
  const normalized = normalizeStatus(providerStatus);
  if (normalized !== 'UPCOMING') return normalized;   // LIVE or FINAL from provider wins

  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return 'UPCOMING';

  const now = Date.now();
  const DURATION_SOCCER_MS = 2.75 * 60 * 60 * 1000;   // ~2h45m window (90+stoppage+HT+buffer)

  if (now < start) return 'UPCOMING';
  if (now <= start + DURATION_SOCCER_MS) return 'LIVE';
  return 'FINAL';
}

/**
 * GET JSON with simple retry/back-off (handles 429 and 5xx briefly).
 * We keep retries low because we query many small endpoints.
 */
async function httpGetJson(url, headers = {}, { retries = 2, baseDelayMs = 400 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const resp = await fetch(url, { headers });
    if (resp.ok) return resp.json();

    const body = await resp.text().catch(() => '');
    const code = resp.status;

    if (attempt < retries && (code === 429 || (code >= 500 && code <= 599))) {
      const jitter = Math.floor(Math.random() * 200);
      const backoff = baseDelayMs * Math.pow(2, attempt) + jitter;
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    throw new Error(
      `GET ${url} -> ${code} ${resp.statusText}${body ? ` | ${body.slice(0, 120)}` : ''}`
    );
  }
}

/** Normalize a variety of upstream status strings into LIVE/FINAL/UPCOMING. */
function normalizeStatus(s) {
  const x = (s || '').toLowerCase();
  if (x.includes('live') || x.includes('in play') || x.includes('inprogress')) return 'LIVE';
  if (x.includes('finished') || x.includes('final') || x.includes('ft') || x.includes('ended'))
    return 'FINAL';
  return 'UPCOMING';
}

/** Build short stable IDs for list rendering. */
function mkId(...parts) {
  return parts.join('_').toLowerCase().replace(/\s+/g, '-');
}

// --------------------------------------------------------------------------------------
// Soccer-only games feed (free TheSportsDB v1)
// --------------------------------------------------------------------------------------
//
// Strategy (to stay within free tier + be useful):
//   • Query “today + tomorrow” (client-local) across a curated league list
//   • If favorite team provided, filter to that team first
//   • If results < min (default 5), broaden (remove team filter) to show a useful slate
//   • Cache per (favoriteTeam, clientTzOffset) for 15 minutes
// --------------------------------------------------------------------------------------

const SOCCER_LEAGUES = [
  'English Premier League',
  'Spanish La Liga',
  'Italian Serie A',
  'German Bundesliga',
  'French Ligue 1',
  'Major League Soccer',
  'UEFA Champions League',
  'Japanese J1 League',
  'Ecuadorian Serie A',
  'Saudi First Division League',
];

/** Convert a UTC ms timestamp to a client-local YYYY-MM-DD using the client’s tz offset. */
function ymdFromOffset(nowMs, clientTzOffsetMinutes) {
  // JS getTimezoneOffset() is minutes to *add* to local to get UTC.
  // We invert it here so that (UTC now - offset) ≈ local wall time in that zone.
  const local = new Date(nowMs - clientTzOffsetMinutes * 60000);
  return local.toISOString().slice(0, 10);
}

/** Return [today, tomorrow] in client-local dates (YYYY-MM-DD). */
function getClientLocalDateSpan(clientTzOffsetMinutes) {
  const now = Date.now();
  const today = ymdFromOffset(now, clientTzOffsetMinutes);
  const tomorrow = ymdFromOffset(now + 24 * 3600 * 1000, clientTzOffsetMinutes);
  return [today, tomorrow];
}

/** Fetch all events for a league on a date (free v1: /eventsday.php). */
async function fetchLeagueOnDate(league, ymd, key) {
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsday.php?d=${ymd}&l=${encodeURIComponent(
    league
  )}`;
  try {
    const j = await httpGetJson(url);
    return j?.events || [];
  } catch (err) {
    console.warn('[games] soccer fetch failed:', league, ymd, '-', err.message);
    return [];
  }
}

/**
 * Fetch soccer for today+tomorrow across leagues.
 *   - favoriteTeam: optional text filter on home/away team names
 *   - clientTzOffsetMinutes: client offset (minutes) for correct local "today"
 */
async function fetchSoccerTwoDayWindow({ leagues, favoriteTeam, clientTzOffsetMinutes }) {
  const key = process.env.THESPORTSDB_KEY || '123'; // free demo key for v1
  const [today, tomorrow] = getClientLocalDateSpan(clientTzOffsetMinutes);

  const out = [];
  for (const l of leagues) {
    const evToday = await fetchLeagueOnDate(l, today, key);
    const evTomorrow = await fetchLeagueOnDate(l, tomorrow, key);

    for (const e of [...evToday, ...evTomorrow]) {
      // Favorite-team filter (substring match, case-insensitive)
      if (favoriteTeam) {
        const t = favoriteTeam.toLowerCase();
        const home = (e.strHomeTeam || '').toLowerCase();
        const away = (e.strAwayTeam || '').toLowerCase();
        if (!home.includes(t) && !away.includes(t)) continue;
      }

      out.push({
        id: mkId('soccer', e.idEvent || e.strEvent, e.dateEvent, e.strTime),
        sport: 'Soccer',
        league: e.strLeague,
        home: e.strHomeTeam,
        away: e.strAwayTeam,
        startTimeIso: `${e.dateEvent}T${(e.strTime || '00:00:00')}Z`,
        status: determineStatus(
          `${e.dateEvent}T${(e.strTime || '00:00:00')}Z`,
          e.strStatus || e.strProgress || e.strPostponed
        ),
      });
    }
  }

  // De-dupe + order: LIVE first, then nearest start time
  const byId = new Map();
  for (const g of out) byId.set(g.id, g);
  const list = Array.from(byId.values()).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'LIVE' ? -1 : 1;
    return new Date(a.startTimeIso) - new Date(b.startTimeIso);
  });

  return list;
}

// ---- 15-minute cache keyed by (favoriteTeam, tz offset) ----
const GAMES_TTL_MS = 15 * 60 * 1000;
let gamesCache = { key: '', data: [], ts: 0 };
let gamesRefreshing = false;

function buildGamesCacheKey({ favoriteTeam, clientTzOffsetMinutes }) {
  return `team:${(favoriteTeam || '').toLowerCase()}|offset:${clientTzOffsetMinutes}`;
}

async function refreshGamesIfNeeded({ favoriteTeam, clientTzOffsetMinutes, min = 5 }) {
  const now = Date.now();
  const key = buildGamesCacheKey({ favoriteTeam, clientTzOffsetMinutes });

  if (gamesCache.key === key && now - gamesCache.ts < GAMES_TTL_MS) return;
  if (gamesRefreshing) return;

  gamesRefreshing = true;
  try {
    // Pass 1: favorite team filter
    let list = await fetchSoccerTwoDayWindow({
      leagues: SOCCER_LEAGUES,
      favoriteTeam,
      clientTzOffsetMinutes,
    });

    // Pass 2: broaden to all leagues if too few
    if ((list?.length || 0) < min) {
      list = await fetchSoccerTwoDayWindow({
        leagues: SOCCER_LEAGUES,
        favoriteTeam: '',
        clientTzOffsetMinutes,
      });
    }

    gamesCache = { key, data: list, ts: Date.now() };
  } catch (err) {
    console.warn('[games] refresh failed, serving stale cache if present:', err.message);
  } finally {
    gamesRefreshing = false;
  }
}

/**
 * GET /api/games/live?team=Barcelona&min=5&client_tz_offset=-240
 *
 * - team: optional favorite team string
 * - min:  minimum desired results (default 5)
 * - client_tz_offset: REQUIRED; minutes from Date.getTimezoneOffset() on the client
 */
app.get('/api/games/live', async (req, res) => {
  const favoriteTeam = (req.query.team || '').toString().trim();
  const min = Math.max(1, parseInt(String(req.query.min || '5'), 10) || 5);
  const clientTzOffsetMinutes = parseInt(String(req.query.client_tz_offset || '0'), 10) || 0;

  await refreshGamesIfNeeded({ favoriteTeam, clientTzOffsetMinutes, min });

  const currentKey = buildGamesCacheKey({ favoriteTeam, clientTzOffsetMinutes });
  if (gamesCache.key !== currentKey) {
    // Cache may belong to a different selector; refresh now.
    await refreshGamesIfNeeded({ favoriteTeam, clientTzOffsetMinutes, min });
  }

  res.json(gamesCache.data || []);
});

// --------------------------------------------------------------------------------------
// Rooms / Chat (in-memory demo store)
// --------------------------------------------------------------------------------------

const rooms = new Map();      // id -> { id, name, createdAt, expiresAt, messages:[], participants: Map, history: Map }
const pastRooms = new Map();  // expired archives: id -> { id, name, createdAt, expiredAt, participantsHistory: [] }
const userRoomHistory = new Map(); // userId -> [{ roomId, name, joinedAt, expiredAt? }]

const now = () => Date.now();

/** Estimate duration by sport. (We primarily use Soccer, but keep others for future use.) */
function estimatedGameDurationMins(sport) {
  const s = (sport || '').toLowerCase();
  if (s.includes('soccer') || s.includes('futbol') || s.includes('football (soccer)')) return 105; // 90 + stoppage
  if (s.includes('basketball') || s.includes('nba')) return 150;
  if (s.includes('hockey') || s.includes('nhl')) return 135;
  if (s.includes('baseball') || s.includes('mlb')) return 180;
  if (s.includes('football') || s.includes('nfl')) return 195;
  return 120;
}

/** Has a room expired? */
function isExpired(room) {
  return now() >= room.expiresAt;
}

/** Create a friendly slug-like id. */
function makeId(name = 'fan-room') {
  const slug = name.trim().replace(/\s+/g, '-').toLowerCase() || 'fan-room';
  const rnd = Math.random().toString(36).slice(2, 7);
  return `${slug}-${rnd}`;
}

/** Create and register a room (default expiry 90 mins unless overridden). */
function createRoom(name, opts = {}) {
  const id = makeId(name);
  const createdAt = now();
  const room = {
    id,
    name,
    createdAt,
    expiresAt: opts.expiresAt ? opts.expiresAt : createdAt + 90 * 60 * 1000,
    messages: [],
    participants: new Map(),
    history: new Map(),
  };
  rooms.set(id, room);
  return room;
}

/** Move a room to archive (and tag users’ history as expired). */
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
  for (const list of userRoomHistory.values()) {
    for (const h of list) {
      if (h.roomId === id && !h.expiredAt) h.expiredAt = now();
    }
  }
}

/** Ensure a specific ID maps to an existing live room; create if missing. */
function getOrCreateRoomById(fixedId, displayName) {
  let r = rooms.get(fixedId);
  if (r && !isExpired(r)) return r;

  const created = createRoom(displayName);
  rooms.delete(created.id); // remove the random id
  created.id = fixedId;     // pin to the fixed id
  rooms.set(fixedId, created);
  return created;
}

// Periodic cleanup + notify lobby
setInterval(() => {
  for (const [id, r] of rooms) {
    if (isExpired(r)) archiveRoom(id);
  }
  io.emit('rooms_updated');
}, 60 * 1000);

// ---------------- Rooms REST ----------------

/** List live rooms (non-expired). */
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

/** Room detail (live or past). */
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

/** Per-user history (live + past, coalesced to most recent for each room). */
app.get('/api/users/:id/rooms', (req, res) => {
  const uid = String(req.params.id);
  const hist = userRoomHistory.get(uid) || [];

  const byRoom = new Map();
  for (const h of hist) {
    const prev = byRoom.get(h.roomId);
    if (!prev || (h.joinedAt || 0) > (prev.joinedAt || 0)) byRoom.set(h.roomId, { ...h });
  }
  const uniq = Array.from(byRoom.values()).map((h) => {
    const live = rooms.get(h.roomId);
    const past = pastRooms.get(h.roomId);
    const participants = live
      ? Array.from(live.history.values())
      : past?.participantsHistory || [];
    const expiredAt = past?.expiredAt || (live && isExpired(live) ? now() : h.expiredAt);
    return { ...h, participants, expiredAt };
  });

  uniq.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
  res.json(uniq);
});

/** Create a room explicitly (with "global-lobby" as a fixed singleton). */
app.post('/api/rooms', (req, res) => {
  const raw = (req.body?.name ?? 'fan room').trim();
  const lower = raw.toLowerCase();

  if (lower === 'global' || lower === 'global lobby' || lower === 'global-lobby') {
    const room = getOrCreateRoomById('global-lobby', 'global');
    io.emit('rooms_updated');
    return res.status(201).json({
      id: room.id,
      name: room.name,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
    });
  }

  // Reuse same-name live room if present
  for (const r of rooms.values()) {
    if (!isExpired(r) && r.name.toLowerCase() === lower) {
      return res.status(200).json({
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      });
    }
  }

  const room = createRoom(raw);
  io.emit('rooms_updated');
  return res.status(201).json({
    id: room.id,
    name: room.name,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
  });
});

/**
 * Create a room from a specific game.
 * Expires at: game end + 24 hours (to keep the conversation going).
 */
app.post('/api/rooms/from-game', (req, res) => {
  const { sport, league, home, away, startTimeIso } = req.body || {};
  if (!sport || !home || !away || !startTimeIso) {
    return res.status(400).json({ error: 'sport, home, away, startTimeIso required' });
  }

  const name = `${(sport || '').toLowerCase()}: ${home} vs ${away}`;
  const start = new Date(startTimeIso).getTime();
  const end = start + estimatedGameDurationMins(String(sport)) * 60_000;

  // Extend room life: +24 hours after the estimated end
  const expiresAt = end + 24 * 60 * 60 * 1000;

  const room = createRoom(name, { expiresAt });
  io.emit('rooms_updated');

  res.status(201).json({
    id: room.id,
    name: room.name,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    league: league || null,
  });
});

/** Delete a room (non-global) and prune it from all histories. */
app.delete('/api/rooms/:id', (req, res) => {
  const { id } = req.params;
  if (id === 'global' || id === 'global-lobby') {
    return res.status(400).json({ error: 'Cannot delete global room' });
  }

  let removed = false;

  if (rooms.has(id)) {
    rooms.delete(id);
    removed = true;
  }
  if (pastRooms.has(id)) {
    pastRooms.delete(id);
    removed = true;
  }

  for (const [uid, list] of userRoomHistory.entries()) {
    const filtered = list.filter((item) => item.roomId !== id);
    if (filtered.length !== list.length) {
      userRoomHistory.set(uid, filtered);
      removed = true;
    }
  }

  if (!removed) return res.status(404).json({ error: 'Room not found' });

  io.emit('rooms_updated');
  return res.sendStatus(204);
});

// --------------------------------------------------------------------------------------
// Socket events
// --------------------------------------------------------------------------------------
io.on('connection', (socket) => {
  socket.data.roomId = null;
  socket.data.userId = null;

  /**
   * join_room
   * - Global lobby is a fixed/singleton room id.
   * - For any other id, create on first join if needed.
   * - If expired at join time, archive & notify the client to pick another room.
   */
  socket.on('join_room', ({ roomId, userId, user: userName }) => {
    if (!roomId) return;

    let room;

    if (roomId === 'global-lobby') {
      room = getOrCreateRoomById('global-lobby', 'global');
    } else {
      room = rooms.get(roomId);
      if (!room) {
        const created = createRoom(roomId.replace(/-[a-z0-9]{5}$/, ''));
        rooms.delete(created.id);
        created.id = roomId;
        rooms.set(roomId, created);
        room = created;
      }
    }

    if (isExpired(room)) {
      archiveRoom(room.id);
      socket.emit('room_expired');
      return;
    }

    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.userId = userId || `guest-${socket.id}`;

    const participant = { id: String(socket.data.userId), name: userName || 'Guest' };
    room.participants.set(participant.id, participant);
    room.history.set(participant.id, participant);

    const list = userRoomHistory.get(participant.id) || [];
    const ts = now();
    const existingIdx = list.findIndex((h) => h.roomId === room.id && !h.expiredAt);
    if (existingIdx >= 0) {
      list[existingIdx].joinedAt = ts;
      list[existingIdx].name = room.name;
    } else {
      list.push({ roomId: room.id, name: room.name, joinedAt: ts });
    }
    userRoomHistory.set(participant.id, list);

    socket.emit('history', room.messages || []);
    io.to(room.id).emit('participants', Array.from(room.participants.values()));
    io.emit('rooms_updated');
  });

  /** Append message to the room’s history and broadcast. */
  socket.on('chat_message', ({ roomId, user, text }) => {
    const room = rooms.get(roomId);
    if (!room || isExpired(room) || !text) return;
    const msg = { user, text, ts: now() };
    room.messages.push(msg);
    io.to(roomId).emit('chat_message', msg);
  });

  /** On disconnect, remove participant from current room and notify lobby. */
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

// --------------------------------------------------------------------------------------
// Debug / health
// --------------------------------------------------------------------------------------
app.get('/_debug/rooms', (_req, res) => {
  const out = [];
  for (const [k, r] of rooms) out.push({ key: k, id: r.id, name: r.name });
  res.json(out);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// --------------------------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------------------------
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`API & Socket listening on ${PORT}`));
