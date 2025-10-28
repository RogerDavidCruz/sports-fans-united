import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Paper, Container, Group, Anchor, Button, Divider, Avatar, Text
} from '@mantine/core';
import { IconHome, IconUser, IconLogout, IconBallFootball } from '@tabler/icons-react';

export default function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const userId = localStorage.getItem('currentUserId');
  const userName = localStorage.getItem('currentUserName') || 'Guest';

  const active = (to: string) => pathname === to;

  function logout() {
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentUserName');
    navigate('/');
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
    <Paper component="header" shadow="md" radius={0}>
      <Container size="xl" py="md">
        <Group justify="space-between" align="center">
          {/* Left: brand + links */}
          <Group gap="lg" align="center">
            <Anchor 
              component={Link} 
              to="/users" 
              fw={700} 
              size="lg"
              style={{ textDecoration: 'none', color: '#667eea', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <IconBallFootball size={24} stroke={2} />
              <span>Sports Fans United</span>
            </Anchor>

            <Divider orientation="vertical" />

            <Anchor 
              component={Link} 
              to="/users"
              c={active('/users') ? 'blue' : 'dimmed'}
              fw={active('/users') ? 600 : 500}
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <IconHome size={16} />
              <span>Home</span>
            </Anchor>

            {userId && (
              <Anchor
                component={Link}
                to={`/user/${userId}/profile`}
                c={active(`/user/${userId}/profile`) ? 'blue' : 'dimmed'}
                fw={active(`/user/${userId}/profile`) ? 600 : 500}
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <IconUser size={16} />
                <span>My Profile</span>
              </Anchor>
            )}
          </Group>

          {/* Right: signed-in user + logout */}
          <Group gap="md">
            <Group gap="sm">
              <Avatar size={32} radius="xl" color="blue" variant="light">
                {getInitials(userName)}
              </Avatar>
              <div>
                <Text size="sm" fw={500}>{userName}</Text>
                <Text size="xs" c="dimmed">Signed in</Text>
              </div>
            </Group>
            <Button 
              variant="light" 
              color="red" 
              onClick={logout}
              leftSection={<IconLogout size={16} />}
            >
              Logout
            </Button>
          </Group>
        </Group>
      </Container>
    </Paper>
  );
}
