import { MantineProvider } from '@mantine/core';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import UserPage from './pages/UserPage';

function App() {
  return (
    <MantineProvider defaultColorScheme="light">
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/users" element={<UserPage />} />
        </Routes>
      </Router>
    </MantineProvider>
  );
}

export default App;
