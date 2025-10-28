import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Container, Title, Text, Card, Loader, Button, Group,
  TextInput, Badge, List, Stack, Avatar, Divider, Grid
} from '@mantine/core';
import { IconUser, IconEdit, IconMail, IconTrophy, IconUsers } from '@tabler/icons-react';

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Container size="xl" style={{ marginTop: '2vh', paddingBottom: '5vh' }}>
      {loading && <Loader mt="md" />}
      {error && <Text c="red" mt="md">{error}</Text>}

      {!loading && !error && user && (
        <>
          {/* Header Section */}
          <Card withBorder shadow="lg" padding="xl" radius="lg" mb="xl">
            <Group align="flex-start" gap="lg">
              <Avatar size={100} radius="xl" color="blue" variant="light">
                {getInitials(user.name)}
              </Avatar>
              <div style={{ flex: 1 }}>
                <Title order={1} mb="xs">{user.name}</Title>
                <Group gap="md" mb="md">
                  <Badge variant="light" color="blue" leftSection={<IconMail size={14} />}>
                    {user.email}
                  </Badge>
                  <Button
                    variant="light"
                    leftSection={<IconEdit size={16} />}
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? 'Cancel Edit' : 'Edit Profile'}
                  </Button>
                  <Button variant="light" component={Link} to="/users">
                    Go to Hub
                  </Button>
                </Group>
              </div>
            </Group>
          </Card>

          <Grid>
            {/* Left Column - Profile Details */}
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Card withBorder shadow="md" padding="xl" radius="md">
                {!editing ? (
                  <Stack gap="lg">
                    <Title order={3}>Profile Information</Title>
                    <Divider />
                    
                    <Grid gutter="md">
                      <Grid.Col span={12}>
                        <Group gap="md">
                          <IconUser size={24} stroke={1.5} style={{ color: '#667eea' }} />
                          <div>
                            <Text size="sm" c="dimmed" fw={500}>Name</Text>
                            <Text size="lg" fw={600}>{user.name}</Text>
                          </div>
                        </Group>
                      </Grid.Col>
                      
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Group gap="md">
                          <div>
                            <Text size="sm" c="dimmed" fw={500}>Favorite Sport</Text>
                            <Text size="md">{user.favorite_sport || '—'}</Text>
                          </div>
                        </Group>
                      </Grid.Col>
                      
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Group gap="md">
                          <IconTrophy size={24} stroke={1.5} style={{ color: '#667eea' }} />
                          <div>
                            <Text size="sm" c="dimmed" fw={500}>Favorite Team</Text>
                            <Text size="md">{user.favorite_team || '—'}</Text>
                          </div>
                        </Group>
                      </Grid.Col>
                      
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Group gap="md">
                          <IconUser size={24} stroke={1.5} style={{ color: '#667eea' }} />
                          <div>
                            <Text size="sm" c="dimmed" fw={500}>Favorite Player</Text>
                            <Text size="md">{user.favorite_player || '—'}</Text>
                          </div>
                        </Group>
                      </Grid.Col>
                    </Grid>
                  </Stack>
                ) : (
                  <Stack gap="md">
                    <Title order={3}>Edit Profile</Title>
                    <Divider />
                    
                    <TextInput
                      label="Name"
                      value={name}
                      onChange={(e) => setName(e.currentTarget.value)}
                      required
                      size="md"
                      placeholder="Your full name"
                    />
                    
                    <TextInput
                      label="Email"
                      value={user.email}
                      disabled
                      size="md"
                    />
                    
                    <TextInput
                      label="Favorite Sport"
                      value={favoriteSport}
                      onChange={(e) => setFavoriteSport(e.currentTarget.value)}
                      placeholder="e.g., Basketball"
                      size="md"
                    />
                    
                    <TextInput
                      label="Favorite Team"
                      value={favoriteTeam}
                      onChange={(e) => setFavoriteTeam(e.currentTarget.value)}
                      placeholder="e.g., Chicago Bulls"
                      size="md"
                    />
                    
                    <TextInput
                      label="Favorite Player"
                      value={favoritePlayer}
                      onChange={(e) => setFavoritePlayer(e.currentTarget.value)}
                      placeholder="e.g., Michael Jordan"
                      size="md"
                    />
                    
                    <Group mt="md">
                      <Button onClick={saveProfile} leftSection={<IconEdit size={16} />}>
                        Save Changes
                      </Button>
                      <Button
                        variant="light"
                        onClick={() => {
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
                  </Stack>
                )}
              </Card>
            </Grid.Col>

            {/* Right Column - Chat Rooms */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder shadow="md" padding="xl" radius="md">
                <Group mb="md">
                  <IconUsers size={24} stroke={1.5} style={{ color: '#667eea' }} />
                  <Title order={3}>Chat Rooms</Title>
                </Group>
                
                {rooms.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    No rooms yet. Join a chat room to get started!
                  </Text>
                ) : (
                  <List spacing="md">
                    {rooms.map((r) => {
                      const live = !r.expiredAt;
                      return (
                        <List.Item key={r.roomId} icon={<IconUsers size={16} />}>
                          <Stack gap="xs">
                            <Group gap="xs">
                              <Link to={`/rooms/${r.roomId}`} style={{ textDecoration: 'none' }}>
                                <Text fw={600} c="blue">{r.name || r.roomId}</Text>
                              </Link>
                              <Badge variant="light" color={live ? 'green' : 'gray'} size="sm">
                                {live ? 'LIVE' : 'PAST'}
                              </Badge>
                            </Group>
                            <Text size="sm" c="dimmed">
                              {(r.participants || []).map((p) => p.name).join(', ') || 'No participants'}
                            </Text>
                          </Stack>
                        </List.Item>
                      );
                    })}
                  </List>
                )}
              </Card>
            </Grid.Col>
          </Grid>
        </>
      )}
    </Container>
  );
}
