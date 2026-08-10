import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Se usa DENTRO de ProtectedRoute (que ya garantiza que hay sesión activa):
 *
 *   <ProtectedRoute>
 *     <RoleRoute allowedRoles={['owner', 'employee']}>
 *       <Dashboard />
 *     </RoleRoute>
 *   </ProtectedRoute>
 *
 * Si el usuario autenticado no tiene un rol permitido para esta ruta, lo
 * redirige a su propio panel (según su rol) en vez de mostrar el contenido.
 * Esto evita que, por ejemplo, un 'employee' entre a /master escribiendo la
 * URL manualmente.
 */
export default function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();

  if (!user) return null; // ProtectedRoute ya se encarga de este caso

  if (!allowedRoles.includes(user.role)) {
    const fallback = user.role === 'master' ? '/master' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return children;
}
