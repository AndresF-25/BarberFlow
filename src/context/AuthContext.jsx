import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api/client';

/**
 * AuthContext — autenticación contra la API BarberFlow (JWT + PostgreSQL).
 *
 * CONTRATO PÚBLICO
 * -----------------
 * { user, isAuthenticated, loading, connectionError, retrying, retrySession, register, login, logout,
 *   business, updateBusiness, createEmployee, updateEmployee, changePassword, listEmployees, listAllBusinesses, listAllUsers,
 *   refreshSession }
 *
 * connectionError: hay un token guardado pero no se pudo comprobar (red caída, API reiniciándose, 429, 5xx).
 * La sesión NO se descarta: solo un 401 (token inválido o caducado) cierra la sesión.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const applySession = useCallback((payload) => {
    if (payload?.token) setToken(payload.token);
    setUser(payload?.user || null);
    setBusiness(payload?.business || null);
    setConnectionError(false);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setBusiness(null);
      return null;
    }
    const data = await api.me();
    setUser(data.user);
    setBusiness(data.business);
    return data;
  }, []);

  // Intenta restaurar la sesión guardada. Solo un 401 la descarta; cualquier otro fallo la conserva.
  const restoreSession = useCallback(async () => {
    try {
      if (getToken()) await refreshSession();
      setConnectionError(false);
    } catch (err) {
      if (err?.status === 401) {
        setToken(null);
        setUser(null);
        setBusiness(null);
        setConnectionError(false);
      } else {
        setConnectionError(true);
      }
    }
  }, [refreshSession]);

  useEffect(() => {
    (async () => {
      await restoreSession();
      setLoading(false);
    })();
  }, [restoreSession]);

  const retrySession = useCallback(async () => {
    setRetrying(true);
    await restoreSession();
    setRetrying(false);
  }, [restoreSession]);

  // Al volver la conexión, reintenta sola.
  useEffect(() => {
    if (!connectionError) return undefined;
    window.addEventListener('online', retrySession);
    return () => window.removeEventListener('online', retrySession);
  }, [connectionError, retrySession]);

  const register = async ({ name, email, password }) => {
    try {
      const result = await api.register({ name, email, password });
      if (!result.ok) return { ok: false, error: result.error };
      applySession(result);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  const login = async ({ email, password }) => {
    try {
      const result = await api.login({ email, password });
      if (!result.ok) return { ok: false, error: result.error };
      applySession(result);
      return { ok: true, user: result.user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore network errors on logout
    }
    setToken(null);
    setUser(null);
    setBusiness(null);
  };

  const createEmployee = async ({ name, email, password, specialty }) => {
    if (!user || user.role !== 'owner') {
      return { ok: false, error: 'Solo el propietario del negocio puede crear empleados.' };
    }
    try {
      const result = await api.createEmployee({ name, email, password, specialty });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, user: result.user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  // `includeInactive` solo lo respeta el servidor para el dueño (los demás reciben siempre a los activos).
  const listEmployees = useCallback(async (opts = {}) => {
    if (!user?.businessId) return [];
    try {
      const data = await api.listEmployees(opts.includeInactive ? { includeInactive: 'true' } : {});
      return data.employees || [];
    } catch {
      return [];
    }
  }, [user?.businessId]);

  // Edita, desactiva/reactiva o restablece la contraseña de un empleado (solo el dueño).
  const updateEmployee = async (id, patch) => {
    if (!user || user.role !== 'owner') {
      return { ok: false, error: 'Solo el propietario del negocio puede editar empleados.' };
    }
    try {
      const result = await api.updateEmployee(id, patch);
      return { ok: true, user: result.user, pendingAppointments: result.pendingAppointments };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  // Cambia la contraseña propia. El servidor cierra las demás sesiones y entrega un token nuevo para esta.
  const changePassword = async ({ currentPassword, newPassword }) => {
    try {
      const result = await api.changePassword({ currentPassword, newPassword });
      if (result?.token) setToken(result.token);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  // Edita el perfil del negocio (solo el dueño) y deja el resultado en `business` para que toda la app lo vea.
  const updateBusiness = async (patch) => {
    if (!user || user.role !== 'owner') {
      return { ok: false, error: 'Solo el propietario del negocio puede editar su perfil.' };
    }
    try {
      const result = await api.patchBusiness(patch);
      setBusiness(result.business);
      return { ok: true, business: result.business };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  const listAllBusinesses = useCallback(async () => {
    if (!user || user.role !== 'master') return [];
    try {
      const data = await api.masterBusinesses();
      return data.businesses || [];
    } catch {
      return [];
    }
  }, [user]);

  const listAllUsers = useCallback(async () => {
    if (!user || user.role !== 'master') return [];
    try {
      const data = await api.masterUsers();
      return data.users || [];
    } catch {
      return [];
    }
  }, [user]);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    loading,
    connectionError,
    retrying,
    retrySession,
    register,
    login,
    logout,
    business,
    updateBusiness,
    createEmployee,
    updateEmployee,
    changePassword,
    listEmployees,
    listAllBusinesses,
    listAllUsers,
    refreshSession,
  }), [user, loading, connectionError, retrying, retrySession, business, listEmployees, listAllBusinesses, listAllUsers, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
