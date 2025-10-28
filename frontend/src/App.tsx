import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import UserPage from './pages/UserPage';
import UserProfilePage from './pages/UserProfilePage';
import ChatRoom from './pages/ChatRoom';
import NavBar from './components/NavBar';

function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const showNav = pathname !== '/'; // hide on landing
  const isLanding = pathname === '/';
  
  return (
    <div style={{ 
      background: isLanding ? 'transparent' : 'linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%)',
      minHeight: '100vh'
    }}>
      {showNav && <NavBar />}
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/users" element={<UserPage />} />
          <Route path="/user/:id/profile" element={<UserProfilePage />} />
          <Route path="/rooms/:roomId" element={<ChatRoom />} />
          <Route path="*" element={<UserPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
