import { useState } from 'react';
import { Container, Title, Tabs, TextInput, PasswordInput, Button, Group, Paper, Stack, Text, Divider, Card } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconBallFootball, IconUsers, IconBolt, IconLogin, IconUserPlus } from '@tabler/icons-react';

export default function LandingPage() {
  const navigate = useNavigate();

  // --- Login form state ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // --- Signup form state ---
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [favoritePlayer, setFavoritePlayer] = useState('');
  const [favoriteSport, setFavoriteSport] = useState('');

  // ---------------- LOGIN ----------------
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const r = await fetch('/api/users');
    if (!r.ok) {
      alert(`Login failed: HTTP ${r.status}`);
      return;
    }
    const users = await r.json();
    const u = users.find(
      (x: any) => x.email?.toLowerCase() === loginEmail.trim().toLowerCase()
    );

    if (!u) {
      alert('No account found for that email');
      return;
    }

    localStorage.setItem('currentUserId', String(u.id));
    localStorage.setItem('currentUserName', u.name || '');
    navigate('/users');
  }

  // ---------------- SIGNUP ----------------
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name: signupName.trim(),
      email: signupEmail.trim().toLowerCase(),
      favorite_team: favoriteTeam,
      favorite_player: favoritePlayer,
      favorite_sport: favoriteSport,
    };

    const r = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      alert(`Signup failed: HTTP ${r.status}`);
      return;
    }
    const u = await r.json();

    localStorage.setItem('currentUserId', String(u.id));
    localStorage.setItem('currentUserName', u.name || '');
    navigate('/users');
  }

  return (
    <Container size="md" style={{ paddingTop: '5vh', paddingBottom: '5vh', minHeight: '100vh' }}>
      <Group justify="center" mb="xl">
        <IconBallFootball size={48} stroke={2} style={{ color: 'white' }} />
        <Title order={1} c="white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
          Sports Fans United
        </Title>
      </Group>

      <Group align="stretch" gap="xl">
        {/* Left side - Features */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <Card shadow="xl" padding="xl" radius="lg" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
            <Stack gap="lg">
              <Title order={2} size="h3">Join the Ultimate Fan Experience</Title>
              <Text size="md" c="dimmed">
                Connect with fellow fans in real-time chat rooms for live games and never miss a moment of the action.
              </Text>
              
              <Divider />
              
              <Stack gap="md">
                <Group gap="md">
                  <IconUsers size={24} stroke={1.5} style={{ color: '#667eea' }} />
                  <div>
                    <Text fw={600}>Live Chat Rooms</Text>
                    <Text size="sm" c="dimmed">Chat with fans during live games</Text>
                  </div>
                </Group>
                
                <Group gap="md">
                  <IconBolt size={24} stroke={1.5} style={{ color: '#667eea' }} />
                  <div>
                    <Text fw={600}>Real-time Updates</Text>
                    <Text size="sm" c="dimmed">Get instant notifications and scores</Text>
                  </div>
                </Group>
                
                <Group gap="md">
                  <IconBallFootball size={24} stroke={1.5} style={{ color: '#667eea' }} />
                  <div>
                    <Text fw={600}>All Sports Covered</Text>
                    <Text size="sm" c="dimmed">Basketball, Football, Soccer & more</Text>
                  </div>
                </Group>
              </Stack>
            </Stack>
          </Card>
        </div>

        {/* Right side - Login/Signup Form */}
        <Paper shadow="xl" p="xl" radius="lg" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', flex: 1, minWidth: '400px' }}>
          <Tabs defaultValue="login" variant="pills">
            <Tabs.List grow mb="xl">
              <Tabs.Tab value="login" leftSection={<IconLogin size={16} />}>
                Login
              </Tabs.Tab>
              <Tabs.Tab value="signup" leftSection={<IconUserPlus size={16} />}>
                Sign Up
              </Tabs.Tab>
            </Tabs.List>

            {/* Login tab */}
            <Tabs.Panel value="login">
              <form onSubmit={handleLogin}>
                <Stack gap="md">
                  <TextInput
                    label="Email"
                    placeholder="your.email@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.currentTarget.value)}
                    required
                    size="md"
                  />
                  <PasswordInput
                    label="Password"
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.currentTarget.value)}
                    required
                    size="md"
                  />
                  <Button type="submit" size="md" mt="md" fullWidth>
                    Sign In
                  </Button>
                </Stack>
              </form>
            </Tabs.Panel>

            {/* Signup tab */}
            <Tabs.Panel value="signup">
              <form onSubmit={handleSignup}>
                <Stack gap="md">
                  <TextInput
                    label="Full Name"
                    placeholder="John Doe"
                    value={signupName}
                    onChange={(e) => setSignupName(e.currentTarget.value)}
                    required
                    size="md"
                  />
                  <TextInput
                    label="Email"
                    placeholder="your.email@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.currentTarget.value)}
                    required
                    size="md"
                  />
                  <PasswordInput
                    label="Password"
                    placeholder="Create a strong password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.currentTarget.value)}
                    required
                    size="md"
                  />
                  
                  <Divider label="Tell us about your sports passion" labelPosition="center" mt="md" />
                  
                  <TextInput
                    label="Favorite Team"
                    placeholder="e.g., Chicago Bulls"
                    value={favoriteTeam}
                    onChange={(e) => setFavoriteTeam(e.currentTarget.value)}
                    required
                    size="md"
                  />
                  <TextInput
                    label="Favorite Player"
                    placeholder="e.g., Michael Jordan"
                    value={favoritePlayer}
                    onChange={(e) => setFavoritePlayer(e.currentTarget.value)}
                    required
                    size="md"
                  />
                  <TextInput
                    label="Favorite Sport"
                    placeholder="e.g., Basketball"
                    value={favoriteSport}
                    onChange={(e) => setFavoriteSport(e.currentTarget.value)}
                    required
                    size="md"
                  />
                  <Button type="submit" size="md" mt="md" fullWidth>
                    Create Account
                  </Button>
                </Stack>
              </form>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Group>
    </Container>
  );
}
