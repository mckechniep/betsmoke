// ============================================
// APP - ROOT COMPONENT
// ============================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Fixtures from './pages/Fixtures';
import FixtureDetail from './pages/FixtureDetail';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Standings from './pages/Standings';
import Notes from './pages/Notes';
import NoteDetail from './pages/NoteDetail';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/fixtures" element={<Fixtures />} />
            <Route path="/fixtures/:id" element={<FixtureDetail />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:id" element={<TeamDetail />} />
            <Route path="/standings" element={<Standings />} />

            {/* Protected Routes */}
            <Route
              path="/notes"
              element={
                <ProtectedRoute>
                  <Notes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notes/:id"
              element={
                <ProtectedRoute>
                  <NoteDetail />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
