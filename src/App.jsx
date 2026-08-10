import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';

import Landing from './pages/landing/Landing';
import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import MasterDashboard from './pages/master/MasterDashboard';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Landing />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/login" element={<Login />} />

          {/* Ruta privada para owner/employee: exige sesión activa y rol correcto */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['owner', 'employee']}>
                  <Dashboard />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Ruta privada exclusiva del administrador de la plataforma */}
          <Route
            path="/master"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['master']}>
                  <MasterDashboard />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Cualquier otra ruta vuelve al inicio */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
