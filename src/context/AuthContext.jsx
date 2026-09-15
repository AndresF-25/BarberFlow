import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api/client';

/**
 * AuthContext — autenticación contra la API BarberFlow (JWT + PostgreSQL).
 *
 * CONTRATO PÚBLICO
 * -----------------
 * { user, isAuthenticated, loading, register, login, logout, business,
 *   createEmployee, listEmployees, listAllBusinesses, listAllUsers, refreshSession }
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((payload) => {
    if (payload?.token) setToken(payload.token);
    setUser(payload?.user || null);
    setBusiness(payload?.business || null);
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

  useEffect(() => {
    (async () => {
      try {
        if (getToken()) await refreshSession();
      } catch {
        setToken(null);
        setUser(null);
        setBusiness(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshSession]);

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

  const listEmployees = useCallback(async () => {
    if (!user?.businessId) return [];
    try {
      const data = await api.listEmployees();
      return data.employees || [];
    } catch {
      return [];
    }
  }, [user?.businessId]);

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
    register,
    login,
    logout,
    business,
    createEmployee,
    listEmployees,
    listAllBusinesses,
    listAllUsers,
    refreshSession,
  }), [user, loading, business, listEmployees, listAllBusinesses, listAllUsers, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
