import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  Container,
  Title,
  TextInput,
  Button,
  Group,
  Stack,
  Card,
  Text,
  Alert,
  Badge,
  Paper,
  Divider,
} from '@mantine/core';
import { IconSend, IconUser, IconCircle, IconClock } from '@tabler/icons-react';

type Msg = { user: string; text: string; ts: number };

const socketURL =
  (import.meta as any).env?.VITE_SOCKET_URL || `http://${window.location.hostname}:5001`;

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();

  // fixed identity from "login"/"signup"
  const userId =
    localStorage.getItem('currentUserId') ||
    `guest-${Math.random().toString(36).slice(2, 7)}`;
  const username = localStorage.getItem('currentUserName') || 'Guest';

  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [expired, setExpired] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // connect socket and join room
  useEffect(() => {
    if (!roomId) return;

    const s: Socket = io(socketURL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = s;

    s.on('connect', () => {
      setConnected(true);
      s.emit('join_room', { roomId, userId, user: username });
    });

    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (err) =>
      console.error('[socket] connect_error', err.message)
    );

    s.on('history', (hist: Msg[]) => setMessages(hist));
    s.on('chat_message', (msg: Msg) =>
      setMessages((prev) => [...prev, msg])
    );
    s.on('room_expired', () => setExpired(true));

    return () => {
      s.off('history');
      s.off('chat_message');
      s.off('room_expired');
      s.disconnect();
      socketRef.current = null;
    };
  }, [roomId, userId, username]);

  // auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    if (!text.trim() || !socketRef.current || !roomId || expired) return;
    socketRef.current.emit('chat_message', {
      roomId,
      user: username,
      text,
    });
    setText('');
  }

  return (
    <Container size="md" style={{ marginTop: '2vh', paddingBottom: '5vh' }}>
      <Card shadow="lg" padding="xl" radius="md" withBorder>
        <Stack gap="lg">
          {/* Header */}
          <div>
            <Group justify="space-between" align="flex-start" mb="md">
              <div style={{ flex: 1 }}>
                <Title order={1} mb="xs">Chat Room</Title>
                <Text fw={600} size="xl" c="blue" mb="sm">
                  {roomId?.replace(/soccer:-|basketball:-|football:-/gi, '') || roomId}
                </Text>
                <Text c="dimmed" size="md">
                  <strong>Room ID:</strong> {roomId}
                </Text>
              </div>
              <Group gap="xs" align="flex-start">
                <Badge
                  variant="light"
                  size="lg"
                  leftSection={<IconUser size={16} />}
                >
                  {username}
                </Badge>
                <Badge
                  color={connected ? 'green' : 'red'}
                  variant="light"
                  size="lg"
                  leftSection={<IconCircle size={16} fill="currentColor" />}
                >
                  {connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </Group>
            </Group>
          </div>

          <Divider />

          {expired && (
            <Alert color="red">
              This room has expired (90-minute limit). Create a new one from the Fan Hub.
            </Alert>
          )}

          {/* Messages */}
          <Card
            withBorder
            shadow="sm"
            padding="md"
            style={{ 
              height: '500px', 
              overflow: 'auto',
              background: '#f8f9fa'
            }}
          >
            <Stack gap="md">
              {messages.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  No messages yet. Start the conversation!
                </Text>
              ) : (
                messages.map((m, i) => (
                  <Paper key={i} p="md" withBorder style={{ background: 'white' }}>
                    <Group gap="xs" mb="xs">
                      <IconUser size={16} />
                      <Text fw={600} size="sm">{m.user}</Text>
                      <Text c="dimmed" size="xs">
                        <IconClock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        {new Date(m.ts).toLocaleTimeString()}
                      </Text>
                    </Group>
                    <Text>{m.text}</Text>
                  </Paper>
                ))
              )}
              <div ref={endRef} />
            </Stack>
          </Card>

          {/* Input */}
          <Group gap="sm" grow>
            <TextInput
              placeholder={expired ? 'Room expired' : 'Type a message…'}
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              disabled={!connected || expired}
              size="md"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button 
              onClick={send} 
              disabled={!connected || expired}
              leftSection={<IconSend size={18} />}
              size="md"
            >
              Send
            </Button>
          </Group>
        </Stack>
      </Card>
    </Container>
  );
}
