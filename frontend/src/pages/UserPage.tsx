import { useEffect, useMemo, useState } from 'react';
import {
  Container, Title, Text, TextInput, Button, Group, Card,
  List, Loader, Grid, Badge, Select, Stack, ActionIcon, Tooltip,
} from '@mantine/core';
import { Link } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { IconMessagePlus, IconTrash } from '@tabler/icons-react';

type User = {
  id: number;
  name: string;
  email: string;
  favorite_team?: string;
  favorite_player?: string;
  favorite_sport?: string;
};

type Game = {
  id: string;
  sport: string;             // "Soccer", "Basketball", ...
  league?: string;           // optional league name
  home: string;
  away: string;
  startTimeIso: string;      // ISO datetime string from backend
  status: 'LIVE' | 'UPCOMING' | 'FINAL';
};

type LiveRoom = {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  participantCount: number;
};

const CATEGORIES = [
  { value: 'ALL', label: 'All sports' },
  { value: 'Soccer', label: 'Soccer' },
  { value: 'Basketball', label: 'Basketball' },
  { value: 'Baseball', label: 'Baseball' },
  { value: 'Football', label: 'American Football' },
  { value: 'Hockey', label: 'Hockey' },
];

function greetingByTime(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Simple fallback if favorite_sport not set
function inferCategory(u: User): string {
  if (u.favorite_sport) return u.favorite_sport;
  const s = `${u.favorite_team ?? ''} ${u.favorite_player ?? ''}`.toLowerCase();
  if (/(real|barcelona|madrid|inter|milan|arsenal|chelsea|uswnt|usa)/.test(s)) return 'Soccer';
  if (/(lakers|celtics|warriors|lebron|jordan|nba)/.test(s)) return 'Basketball';
  if (/(yankees|dodgers|mlb)/.test(s)) return 'Baseball';
  if (/(patriots|nfl)/.test(s)) return 'Football';
  if (/(bruins|nhl)/.test(s)) return 'Hockey';
  return 'Unknown';
}

const socketURL =
  (import.meta as any).env?.VITE_SOCKET_URL || `http://${window.location.hostname}:5001`;

export default function UserPage() {
  // Users + me
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [me, setMe] = useState<User | null>(null);

  // Filters
  const [category, setCategory] = useState<string>('ALL');
  const [teamQuery, setTeamQuery] = useState('');
  const [playerQuery, setPlayerQuery] = useState('');

  // Live rooms
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [creating, setCreating] = useState(false);

  // Live & upcoming games (from backend)
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string>();

  function fmtLocalTime(iso: string) {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  async function fetchRooms() {
    const r = await fetch('/api/rooms');
    if (r.ok) setRooms(await r.json());
  }

  async function fetchGames() {
    try {
      setGamesLoading(true);
      setGamesError(undefined);
      const r = await fetch('/api/games/live');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: Game[] = await r.json();
      setGames(data);
    } catch (e: any) {
      setGamesError(e.message || 'Failed to load games');
    } finally {
      setGamesLoading(false);
    }
  }

  // Socket for room list updates — with correct cleanup
  useEffect(() => {
    const s: Socket = io(socketURL, { transports: ['websocket', 'polling'] });
    s.on('rooms_updated', fetchRooms);
    return () => {
      s.off('rooms_updated', fetchRooms);
      s.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setUsers)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));

    const uid = localStorage.getItem('currentUserId');
    if (uid) {
      fetch(`/api/users/${uid}`).then(async (r) => r.ok && setMe(await r.json()));
    }

    fetchRooms();

    // Games: initial + auto-refresh every 60s
    fetchGames();
    const ivRooms = setInterval(fetchRooms, 30_000);
    const ivGames = setInterval(fetchGames, 60_000);
    return () => {
      clearInterval(ivRooms);
      clearInterval(ivGames);
    };
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const cat = inferCategory(u);
      const catPass = category === 'ALL' || cat === category;
      const teamPass = !teamQuery || (u.favorite_team ?? '').toLowerCase().includes(teamQuery.toLowerCase());
      const playerPass = !playerQuery || (u.favorite_player ?? '').toLowerCase().includes(playerQuery.toLowerCase());
      return catPass && teamPass && playerPass;
    });
  }, [users, category, teamQuery, playerQuery]);

  function minutesLeft(expiresAt: number) {
    const ms = expiresAt - Date.now();
    return Math.max(0, Math.ceil(ms / 60000));
  }

  // Manual room create (from text input)
  async function createRoom() {
    const input = document.getElementById('roomName') as HTMLInputElement | null;
    const name = (input?.value || '').trim();
    if (!name) {
      alert('Enter a room name');
      return;
    }
    try {
      setCreating(true);
      const r = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const room = await r.json();
      window.location.href = `/rooms/${room.id}`;
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  }

  // NEW: Create a room directly from a game row (hits POST /api/rooms/from-game)
  async function createRoomFromGame(g: Game) {
    try {
      const r = await fetch('/api/rooms/from-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: g.sport,
          league: g.league,
          home: g.home,
          away: g.away,
          startTimeIso: g.startTimeIso,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const room = await r.json();
      // Navigate to the new/derived room
      window.location.href = `/rooms/${room.id}`;
    } catch (e: any) {
      alert(`Could not create room: ${e.message}`);
    }
  }

  return (
    <Container size="lg" style={{ marginTop: '5vh' }}>
      {/* Header */}
      <Group justify="space-between" align="flex-start" style={{ marginTop: '5vh' }}>
        <div>
          <Title order={2}>
            {greetingByTime()}, {me?.name ? me.name : 'Fan'} 👋
          </Title>
          <Text c="dimmed" mt="xs">
            {me
              ? (() => {
                  const bits = [
                    me.favorite_sport && `into ${me.favorite_sport}`,
                    me.favorite_team && `rooting for ${me.favorite_team}`,
                    me.favorite_player && `watching ${me.favorite_player}`,
                  ].filter(Boolean);
                  return bits.length ? `Welcome back to your Fan Homebase — ${bits.join(' · ')}.` : 'Welcome back to your Fan Homebase.';
                })()
              : 'Browse users, create a chat room, and see live/upcoming games.'}
          </Text>
        </div>
      </Group>
      <Text c="dimmed" mt="xs">Browse users, create a chat room, and see live/upcoming games.</Text>

      <Grid mt="lg">
        {/* Left: Users + filters */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder shadow="sm" padding="lg">
            <Title order={4}>All Users</Title>

            <Stack mt="md">
              <Select
                label="Sport"
                data={CATEGORIES}
                value={category}
                onChange={(v) => setCategory(v || 'ALL')}
              />
              <Group grow>
                <TextInput
                  label="Filter by Favorite Team"
                  placeholder="e.g., Barcelona"
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.currentTarget.value)}
                />
                <TextInput
                  label="Filter by Favorite Player"
                  placeholder="e.g., Messi"
                  value={playerQuery}
                  onChange={(e) => setPlayerQuery(e.currentTarget.value)}
                />
              </Group>
            </Stack>

            {loading && <Loader mt="md" />}
            {error && <Text c="red">{error}</Text>}

            {!loading && !error && (
              <List spacing="sm" mt="md">
                {filtered.map((u) => {
                  const cat = inferCategory(u);
                  return (
                    <List.Item key={u.id}>
                      <Badge variant="light" mr="sm">{cat}</Badge>
                      <Link to={`/user/${u.id}/profile`} style={{ textDecoration: 'none' }}>
                        <strong>{u.name}</strong>
                      </Link>{' '}
                      — {u.email} {u.favorite_team ? `(${u.favorite_team})` : ''}
                    </List.Item>
                  );
                })}
                {filtered.length === 0 && <Text c="dimmed">No users match your filters.</Text>}
              </List>
            )}
          </Card>

          {/* Games feed (now fetched) */}
          <Card withBorder shadow="sm" padding="lg" mt="lg">
            <Group justify="space-between" align="center">
              <Title order={4}>Live & Upcoming Games</Title>
              <Button size="xs" variant="light" onClick={fetchGames} loading={gamesLoading}>
                Refresh
              </Button>
            </Group>

            {gamesLoading && <Loader mt="md" />}

            {gamesError && (
              <Text c="red" mt="md">Failed to load games: {gamesError}</Text>
            )}

            {!gamesLoading && !gamesError && (
              <List spacing="sm" mt="md">
                {games.length === 0 && (
                  <Text c="dimmed">No games found for today yet.</Text>
                )}
                {games.map((g) => (
                  <List.Item key={g.id}>
                    <Badge
                      variant="light"
                      color={g.status === 'LIVE' ? 'red' : g.status === 'UPCOMING' ? 'blue' : 'gray'}
                      mr="sm"
                    >
                      {g.status}
                    </Badge>

                    {/* Basic game text */}
                    <Text component="span">
                      <strong>{g.home}</strong> vs <strong>{g.away}</strong>
                      {g.league ? ` — ${g.league}` : ''} · {fmtLocalTime(g.startTimeIso)}
                    </Text>

                    {/* NEW: quick-create chat for this game */}
                    <Tooltip label="Start a chat for this game">
                      <ActionIcon
                        aria-label="Create chat room"
                        variant="light"
                        ml="sm"
                        onClick={() => createRoomFromGame(g)}
                      >
                        <IconMessagePlus size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </List.Item>
                ))}
              </List>
            )}

            <Text c="dimmed" mt="sm" size="sm">
              Powered by TheSportsDB (soccer) & balldontlie (NBA). Auto-refreshes every 60s.
            </Text>
          </Card>
        </Grid.Col>

        {/* Right: Create room + Live rooms */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder shadow="sm" padding="lg">
            <Title order={4}>Start a Chat Room</Title>
            <Text c="dimmed" mt="xs">Create a room for a match or topic and share the URL.</Text>
            <Stack mt="md">
              <TextInput label="Room name" placeholder="e.g., USA vs Brazil" id="roomName" />
              <Group>
                <Button onClick={createRoom} loading={creating}>Create Room</Button>
                <Button variant="light" onClick={() => (window.location.href = `/rooms/global-lobby`)}>
                  Join Global Lobby
                </Button>
              </Group>
              <Text c="dimmed" size="sm">Anyone with the link can join. Messages are realtime.</Text>
            </Stack>
          </Card>

          <Card withBorder shadow="sm" padding="lg" mt="lg">
            <Title order={4}>Live Rooms (90-min)</Title>
            {rooms.length === 0 ? (
              <Text c="dimmed" mt="md">No live rooms yet.</Text>
            ) : (
              <List spacing="sm" mt="md">
                {rooms.map((r) => (
                  <List.Item key={r.id}>
                    <Group justify="space-between" align="center" gap="xs">
                      <div>
                        <Link to={`/rooms/${r.id}`} style={{ textDecoration: 'none' }}>
                          <strong>{r.name}</strong>
                        </Link>{' '}
                        — <Badge variant="light" mr="sm">{r.participantCount} online</Badge>
                        <Text component="span" c="dimmed" size="sm">
                          {minutesLeft(r.expiresAt)} min left
                        </Text>
                      </div>

                      {/* 🗑️ Delete button (hidden for global rooms) */}
                      {r.id !== 'global' && r.id !== 'global-lobby' && (
                        <Tooltip label="Delete this room">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={async () => {
                              if (!confirm(`Delete room "${r.name}"?`)) return;
                              try {
                                const res = await fetch(`/api/rooms/${r.id}`, {
                                  method: 'DELETE',
                                });
                                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                // remove from UI
                                setRooms((prev) => prev.filter((x) => x.id !== r.id));
                                // optional cleanup from localStorage if stored
                                localStorage.removeItem(`room_${r.id}`);
                              } catch (e: any) {
                                alert(`Failed to delete room: ${e.message}`);
                              }
                            }}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </List.Item>
                ))}
              </List>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
