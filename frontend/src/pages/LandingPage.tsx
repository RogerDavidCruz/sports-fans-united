import { Button, Container, Title, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <Container size="md" style={{ textAlign: 'center', marginTop: '10vh' }}>
      <Title order={1}>Sports Fans United</Title>
      <Text mt="md" size="lg">
        Increase fan engagement during live matches
      </Text>
      <Button component={Link} to="/users" mt="xl" size="lg">
        Create a User
      </Button>
    </Container>
  );
};

export default LandingPage;
