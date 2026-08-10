import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Envuelve cualquier ruta privada (ej. /dashboard).
 * Si no hay sesión activa, redirige a /login guardando la ruta original
 * en location.state.from para volver ahí después de iniciar sesión.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // evita parpadeo mientras se lee localStorage

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
