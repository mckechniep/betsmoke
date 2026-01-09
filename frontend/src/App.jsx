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
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Fixtures from './pages/Fixtures';
import FixtureDetail from './pages/FixtureDetail';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Competitions from './pages/Competitions';
import Notes from './pages/Notes';
import NoteDetail from './pages/NoteDetail';
import AccountSettings from './pages/AccountSettings';
import ModelPerformance from './pages/ModelPerformance';
import ModelArchitecture from './pages/ModelArchitecture';

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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/fixtures" element={<Fixtures />} />
            <Route path="/fixtures/:id" element={<FixtureDetail />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:id" element={<TeamDetail />} />
            <Route path="/competitions" element={<Competitions />} />
            <Route path="/model-performance" element={<ModelPerformance />} />
            <Route path="/model-architecture" element={<ModelArchitecture />} />

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
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AccountSettings />
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
