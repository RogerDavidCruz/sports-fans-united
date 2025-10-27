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
} from '@mantine/core';

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
    <Container size="sm" style={{ marginTop: '5vh' }}>
      <Group justify="space-between" align="center">
        <Title order={2}>Room: {roomId}</Title>
        <Group>
          <Badge variant="light">You: {username}</Badge>
          <Badge color={connected ? 'green' : 'red'} variant="light">
            {connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </Group>
      </Group>

      {expired && (
        <Alert color="red" mt="md">
          This room has expired (90-minute limit). Create a new one from the Fan
          Hub.
        </Alert>
      )}

      <Card
        withBorder
        shadow="sm"
        padding="lg"
        mt="lg"
        style={{ maxHeight: 420, overflow: 'auto' }}
      >
        <Stack gap="xs">
          {messages.map((m, i) => (
            <div key={i}>
              <Text fw={700}>{m.user}</Text>
              <Text>{m.text}</Text>
              <Text c="dimmed" size="xs">
                {new Date(m.ts).toLocaleTimeString()}
              </Text>
            </div>
          ))}
          <div ref={endRef} />
        </Stack>
      </Card>

      <Group mt="md">
        <TextInput
          placeholder={expired ? 'Room expired' : 'Type a message…'}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          style={{ flex: 1 }}
          disabled={!connected || expired}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={!connected || expired}>
          Send
        </Button>
      </Group>
    </Container>
  );
}
