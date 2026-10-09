import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SessionUnavailable from './SessionUnavailable';

/**
 * Envuelve cualquier ruta privada (ej. /dashboard).
 * Si no hay sesión activa, redirige a /login guardando la ruta original
 * en location.state.from para volver ahí después de iniciar sesión.
 * Si hay un token guardado pero no se pudo verificar (red caída, API reiniciándose), NO se cierra la sesión:
 * se muestra una pantalla para reintentar.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, connectionError, retrying, retrySession } = useAuth();
  const location = useLocation();

  if (loading) return null; // evita parpadeo mientras se lee localStorage

  if (connectionError) return <SessionUnavailable onRetry={retrySession} retrying={retrying} />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
