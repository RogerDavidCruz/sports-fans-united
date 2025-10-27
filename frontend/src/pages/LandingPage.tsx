import { useState } from 'react';
import { Container, Title, Tabs, TextInput, PasswordInput, Button, Group } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

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
    <Container size="sm" style={{ marginTop: '10vh' }}>
      <Title order={1} ta="center" mb="lg">
        Sports Fans United
      </Title>

      <Tabs defaultValue="login">
        <Tabs.List grow>
          <Tabs.Tab value="login">Login</Tabs.Tab>
          <Tabs.Tab value="signup">Sign Up</Tabs.Tab>
        </Tabs.List>

        {/* Login tab */}
        <Tabs.Panel value="login" pt="md">
          <form onSubmit={handleLogin}>
            <TextInput
              label="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.currentTarget.value)}
              required
              mt="md"
            />
            <Group mt="lg">
              <Button type="submit">Login</Button>
            </Group>
          </form>
        </Tabs.Panel>

        {/* Signup tab */}
        <Tabs.Panel value="signup" pt="md">
          <form onSubmit={handleSignup}>
            <TextInput
              label="Name"
              value={signupName}
              onChange={(e) => setSignupName(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.currentTarget.value)}
              required
              mt="md"
            />
            <PasswordInput
              label="Password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.currentTarget.value)}
              required
              mt="md"
            />
            <TextInput
              label="Favorite Team"
              value={favoriteTeam}
              onChange={(e) => setFavoriteTeam(e.currentTarget.value)}
              mt="md"
              required
            />
            <TextInput
              label="Favorite Player"
              value={favoritePlayer}
              onChange={(e) => setFavoritePlayer(e.currentTarget.value)}
              mt="md"
              required
            />
            <TextInput
              label="Favorite Sport"
              value={favoriteSport}
              onChange={(e) => setFavoriteSport(e.currentTarget.value)}
              mt="md"
              required
            />
            <Group mt="lg">
              <Button type="submit">Create Account</Button>
            </Group>
          </form>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
