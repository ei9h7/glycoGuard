import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

// Auth screens
import Login    from "./screens/auth/Login";
import Register from "./screens/auth/Register";

// App screens
import Home     from "./screens/Home";
import Meals    from "./screens/Meals";
import Reports  from "./screens/Reports";
import AI       from "./screens/AI";
import Settings from "./screens/Settings";

// Layout
import AppShell from "./components/AppShell";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ background:"#0f1f35", height:"100vh" }} />;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected app */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route index          element={<Home />} />
        <Route path="meals"   element={<Meals />} />
        <Route path="reports" element={<Reports />} />
        <Route path="ai"      element={<AI />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
