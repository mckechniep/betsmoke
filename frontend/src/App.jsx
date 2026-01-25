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
            {/* Public Routes - Only auth pages and landing */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Routes - All app content requires login */}
            <Route
              path="/fixtures"
              element={
                <ProtectedRoute>
                  <Fixtures />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fixtures/:id"
              element={
                <ProtectedRoute>
                  <FixtureDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teams"
              element={
                <ProtectedRoute>
                  <Teams />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teams/:id"
              element={
                <ProtectedRoute>
                  <TeamDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitions"
              element={
                <ProtectedRoute>
                  <Competitions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/model-performance"
              element={
                <ProtectedRoute>
                  <ModelPerformance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/model-architecture"
              element={
                <ProtectedRoute>
                  <ModelArchitecture />
                </ProtectedRoute>
              }
            />
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
