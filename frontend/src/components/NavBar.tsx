import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Paper, Container, Group, Anchor, Button, Badge, Divider
} from '@mantine/core';

export default function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const userId = localStorage.getItem('currentUserId');
  const userName = localStorage.getItem('currentUserName') || 'Guest';

  const active = (to: string) =>
    pathname === to ? { textDecoration: 'underline', fontWeight: 600 } : undefined;

  function logout() {
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentUserName');
    navigate('/');
  }

  return (
    <Paper component="header" shadow="xs" radius={0}>
      <Container size="lg" py="sm">
        <Group justify="space-between" align="center">
          {/* Left: brand + links */}
          <Group gap="lg" align="center">
            <Anchor component={Link} to="/users" fw={700} style={{ textDecoration: 'none' }}>
              Sports Fans United
            </Anchor>

            <Divider orientation="vertical" />

            <Anchor component={Link} to="/users" style={active('/users')}>
              Home
            </Anchor>

            {userId && (
              <Anchor
                component={Link}
                to={`/user/${userId}/profile`}
                style={active(`/user/${userId}/profile`)}
              >
                My Profile
              </Anchor>
            )}
          </Group>

          {/* Right: signed-in chip + logout */}
          <Group gap="md">
            <Badge variant="light" tt="uppercase" size="sm">
              Signed in as {userName}
            </Badge>
            <Button variant="light" color="red" onClick={logout}>
              Logout
            </Button>
          </Group>
        </Group>
      </Container>
    </Paper>
  );
}
