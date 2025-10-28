import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Card, Loader, Button, Group,
  TextInput, Badge, List
} from '@mantine/core';

type User = {
  id: number;
  name: string;
  email: string;
  favorite_sport?: string;
  favorite_team?: string;
  favorite_player?: string;
};

type JoinedRoom = {
  roomId: string;
  name: string;
  joinedAt?: number;
  expiredAt?: number;
  participants?: { id: string; name: string }[];
};

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [rooms, setRooms] = useState<JoinedRoom[]>([]);

  // inline edit state
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [favoriteSport, setFavoriteSport] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [favoritePlayer, setFavoritePlayer] = useState('');

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        setLoading(true);
        const [uRes, rRes] = await Promise.all([
          fetch(`/api/users/${id}`),
          fetch(`/api/users/${id}/rooms`),
        ]);
        if (!uRes.ok) throw new Error(`HTTP ${uRes.status}`);
        const u: User = await uRes.json();
        setUser(u);

        // seed form fields
        setName(u.name || '');
        setFavoriteSport(u.favorite_sport || '');
        setFavoriteTeam(u.favorite_team || '');
        setFavoritePlayer(u.favorite_player || '');

        if (rRes.ok) {
          const raw: JoinedRoom[] = await rRes.json();
          const map = new Map<string, JoinedRoom>();
          for (const h of raw) {
            const prev = map.get(h.roomId);
            if (!prev || (h.joinedAt || 0) > (prev.joinedAt || 0)) map.set(h.roomId, h);
          }
          const deduped = Array.from(map.values())
            .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
          setRooms(deduped);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  async function saveProfile() {
    if (!user) return;
    const payload = {
      name: name.trim(),
      favorite_sport: favoriteSport.trim(),
      favorite_team: favoriteTeam.trim(),
      favorite_player: favoritePlayer.trim(),
    };

    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert(`Save failed: HTTP ${res.status}`);
      return;
    }
    const updated: User = await res.json();
    setUser(updated);
    setEditing(false);

    // keep navbar chip in sync
    localStorage.setItem('currentUserName', updated.name || '');
  }

  return (
    <Container size="lg" style={{ marginTop: '5vh' }}>
      <Title order={2}>My Profile</Title>

      {loading && <Loader mt="md" />}
      {error && <Text c="red" mt="md">{error}</Text>}

      {!loading && !error && user && (
        <>
          {/* Profile card */}
          <Card withBorder shadow="sm" padding="lg" mt="lg">
            {!editing ? (
              <>
                <Text>
                  <strong>Name:</strong> {user.name}
                </Text>
                <Text>
                  <strong>Email:</strong> {user.email}
                </Text>
                <Text>
                  <strong>Favorite Sport:</strong> {user.favorite_sport || '—'}
                </Text>
                <Text>
                  <strong>Favorite Team:</strong> {user.favorite_team || '—'}
                </Text>
                <Text>
                  <strong>Favorite Player:</strong> {user.favorite_player || '—'}
                </Text>

                <Group mt="md">
                  <Button onClick={() => setEditing(true)}>Edit Profile</Button>
                  <Button variant="light" component={Link} to="/users">
                    Go to Hub
                  </Button>
                </Group>
              </>
            ) : (
              <>
                <TextInput
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  required
                />
                <Text mt="xs" c="dimmed" size="sm">
                  Email: {user.email}
                </Text>

                <Group grow mt="md">
                  <TextInput
                    label="Favorite Sport"
                    value={favoriteSport}
                    onChange={(e) => setFavoriteSport(e.currentTarget.value)}
                    placeholder="e.g., Basketball"
                  />
                  <TextInput
                    label="Favorite Team"
                    value={favoriteTeam}
                    onChange={(e) => setFavoriteTeam(e.currentTarget.value)}
                    placeholder="e.g., Chicago Bulls"
                  />
                  <TextInput
                    label="Favorite Player"
                    value={favoritePlayer}
                    onChange={(e) => setFavoritePlayer(e.currentTarget.value)}
                    placeholder="e.g., Michael Jordan"
                  />
                </Group>

                <Group mt="md">
                  <Button onClick={saveProfile}>Save</Button>
                  <Button
                    variant="light"
                    onClick={() => {
                      // revert to last saved values
                      if (!user) return;
                      setName(user.name || '');
                      setFavoriteSport(user.favorite_sport || '');
                      setFavoriteTeam(user.favorite_team || '');
                      setFavoritePlayer(user.favorite_player || '');
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </Group>
              </>
            )}
          </Card>

          {/* Rooms joined */}
          <Card withBorder shadow="sm" padding="lg" mt="lg">
            <Title order={4}>Chat Rooms You Joined</Title>
            {rooms.length === 0 ? (
              <Text c="dimmed" mt="md">No rooms yet.</Text>
            ) : (
              <List spacing="md" mt="md">
                {rooms.map((r) => {
                  const live = !r.expiredAt;
                  return (
                    <List.Item key={r.roomId}>
                      <Group gap="xs">
                        <Link to={`/rooms/${r.roomId}`} style={{ textDecoration: 'none' }}>
                          <strong>{r.name || r.roomId}</strong>
                        </Link>
                        <Badge variant="light" color={live ? 'green' : 'gray'}>
                          {live ? 'LIVE' : 'PAST'}
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        Participants:{' '}
                        {(r.participants || []).map((p) => p.name).join(', ') || '—'}
                      </Text>
                    </List.Item>
                  );
                })}
              </List>
            )}
          </Card>
        </>
      )}
    </Container>
  );
}
