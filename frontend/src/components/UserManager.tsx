import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Button,
  Card,
  Group,
  Stack,
  TextInput,
  Title,
  Container,
  Space,
  ActionIcon,
  useMantineColorScheme
} from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';

interface User {
  id: number;
  name: string;
  email: string;
  favorite_team: string;
  favorite_player: string;
}

const UserManager = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const API = '/api/users'; // uses Vite proxy

  const fetchUsers = async () => {
    const { data } = await axios.get(API);
    setUsers(data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `${API}/${editingId}` : API;

    await axios({
      method: editingId ? 'put' : 'post',
      url,
      data: formData,
    });

    setFormData({});
    setEditingId(null);
    fetchUsers();
  };

  const handleEdit = (user: User) => {
    setFormData(user);
    setEditingId(user.id);
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`${API}/${id}`);
    fetchUsers();
  };

  return (
    <Container size="sm" py="md">
      <Group justify="space-between" align="center" mb="md">
        <Title order={2}>User Manager</Title>
        <ActionIcon
          onClick={() => toggleColorScheme()}
          variant="outline"
          color={dark ? 'yellow' : 'blue'}
          title="Toggle color scheme"
        >
          {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
      </Group>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <TextInput
            label="Name"
            name="name"
            value={formData.name || ''}
            onChange={handleChange}
            required
            mb="sm"
          />
          <TextInput
            label="Email"
            name="email"
            value={formData.email || ''}
            onChange={handleChange}
            required
            mb="sm"
          />
          <TextInput
            label="Favorite Team"
            name="favorite_team"
            value={formData.favorite_team || ''}
            onChange={handleChange}
            mb="sm"
          />
          <TextInput
            label="Favorite Player"
            name="favorite_player"
            value={formData.favorite_player || ''}
            onChange={handleChange}
            mb="sm"
          />
          <Button type="submit" color="blue">
            {editingId ? 'Update User' : 'Add User'}
          </Button>
        </div>
      </form>

      <Space h="lg" />

      <Stack>
        {users.map(user => (
          <Card key={user.id} shadow="sm" padding="md" radius="md" withBorder>
            <Title order={4}>{user.name}</Title>
            <div>{user.email}</div>
            <div>Team: {user.favorite_team} | Player: {user.favorite_player}</div>
            <Group mt="sm">
              <Button variant="light" color="blue" onClick={() => handleEdit(user)}>Edit</Button>
              <Button variant="light" color="red" onClick={() => handleDelete(user.id)}>Delete</Button>
            </Group>
          </Card>
        ))}
      </Stack>
    </Container>
  );
};

export default UserManager;
