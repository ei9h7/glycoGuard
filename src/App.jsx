import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useChild } from "./hooks/useChild";

// Auth screens
import Login      from "./screens/auth/Login";
import Register   from "./screens/auth/Register";
import ChildSetup from "./screens/auth/ChildSetup";

// App screens
import Home          from "./screens/Home";
import Meals         from "./screens/Meals";
import Reports       from "./screens/Reports";
import AI            from "./screens/AI";
import Settings      from "./screens/Settings";
import GlucoseHistory from "./screens/GlucoseHistory";

// Layout
import AppShell from "./components/AppShell";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ background:"#0f1f35", height:"100vh" }} />;
  return user ? children : <Navigate to="/login" replace />;
}

function ChildGuard({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { child, loading: childLoading } = useChild();
  if (authLoading || childLoading) return <div style={{ background:"#0f1f35", height:"100vh" }} />;
  return child ? children : <Navigate to="/setup" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Child setup — protected but pre-child */}
      <Route path="/setup" element={
        <ProtectedRoute>
          <ChildSetup />
        </ProtectedRoute>
      } />

      {/* Protected app — requires auth + child profile */}
      <Route path="/" element={
        <ProtectedRoute>
          <ChildGuard>
            <AppShell />
          </ChildGuard>
        </ProtectedRoute>
      }>
        <Route index           element={<Home />} />
        <Route path="meals"    element={<Meals />} />
        <Route path="reports"  element={<Reports />} />
        <Route path="ai"       element={<AI />} />
        <Route path="settings" element={<Settings />} />
        <Route path="glucose"  element={<GlucoseHistory />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
