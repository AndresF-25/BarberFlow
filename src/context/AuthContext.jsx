import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * AuthContext — autenticación simulada para desarrollo, ahora con RBAC.
 *
 * Los usuarios se guardan en localStorage bajo USERS_KEY, los negocios bajo
 * BUSINESSES_KEY, y la sesión activa bajo SESSION_KEY. Esto sigue siendo un
 * mock: en producción, register()/login()/createEmployee() deben reemplazarse
 * por llamadas a tu API real, y SESSION_KEY debe contener un token (JWT,
 * cookie de sesión, etc.) en lugar del id de usuario en texto plano.
 *
 * MODELO DE DATOS
 * ----------------
 * User:     { id, name, email, password, role, businessId }
 *           role = 'master' | 'owner' | 'employee'
 *           businessId = null para 'master', string para 'owner'/'employee'
 * Business: { id, name, logo, description, phone, address }
 *
 * Un usuario NO contiene los datos del negocio embebidos: solo referencia
 * businessId. Los recursos del negocio (servicios, clientes, citas, ventas,
 * etc. — hoy manejados dentro de Dashboard.jsx) deberán filtrarse por ese
 * businessId cuando se conecte un backend real.
 *
 * CONTRATO PÚBLICO
 * -----------------
 * Se mantiene igual que antes: { user, isAuthenticated, loading, register,
 * login, logout }. Se agregan de forma ADITIVA (no rompen nada existente):
 *   - business: el Business del usuario actual (o null si es master/no aplica)
 *   - createEmployee: solo debe ser invocado por un 'owner' para crear
 *     empleados dentro de su propio negocio
 *   - listEmployees: lista los empleados del negocio del usuario actual
 *   - listAllBusinesses / listAllUsers: uso exclusivo del panel 'master'
 */

const USERS_KEY = 'barberflow_users';
const BUSINESSES_KEY = 'barberflow_businesses';
const SESSION_KEY = 'barberflow_session'; // ahora guarda el ID del usuario, no el email

// Credenciales del usuario master sembrado en el primer arranque.
// En producción esto NO debe vivir en el frontend: el master se crearía
// directamente en la base de datos / backend.
const MASTER_SEED = {
  id: 'user-master',
  name: 'Administrador BarberFlow',
  email: 'admin@barberflow.com',
  password: 'master123',
  role: 'master',
  businessId: null,
};

const AuthContext = createContext(null);

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readBusinesses() {
  try {
    return JSON.parse(localStorage.getItem(BUSINESSES_KEY)) || [];
  } catch {
    return [];
  }
}

function writeBusinesses(businesses) {
  localStorage.setItem(BUSINESSES_KEY, JSON.stringify(businesses));
}

// Garantiza que exista un usuario 'master' desde el primer arranque de la app.
function ensureMasterSeed() {
  const users = readUsers();
  const hasMaster = users.some((u) => u.role === 'master');
  if (!hasMaster) {
    writeUsers([...users, MASTER_SEED]);
  }
}

// Migra usuarios creados con el modelo viejo (sin role/businessId/id) para
// que no rompan la app si ya había datos guardados en localStorage.
function migrateLegacyUsers() {
  const users = readUsers();
  let changed = false;
  const migrated = users.map((u) => {
    if (u.role) return u;
    changed = true;
    return { id: 'user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), role: 'owner', businessId: null, ...u };
  });
  if (changed) writeUsers(migrated);
}

function publicUser(u) {
  if (!u) return null;
  // No exponemos password en el objeto de sesión que consume la UI.
  const { password, ...rest } = u;
  return rest;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al montar: siembra el master si hace falta, migra usuarios viejos y
  // restaura la sesión activa (si existe) desde localStorage.
  useEffect(() => {
    ensureMasterSeed();
    migrateLegacyUsers();

    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId) {
      const found = readUsers().find((u) => u.id === sessionId);
      if (found) setUser(publicUser(found));
    }
    setLoading(false);
  }, []);

  // Registro público: siempre crea un Business nuevo + un usuario 'owner'
  // asociado a ese negocio. No permite elegir 'master' desde el formulario.
  const register = ({ name, email, password }) => {
    const users = readUsers();
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return { ok: false, error: 'Ya existe una cuenta con este correo.' };
    }

    const businessId = 'business-' + Date.now();
    const newBusiness = {
      id: businessId,
      name: `Barbería de ${name}`,
      logo: null,
      description: '',
      phone: '',
      address: '',
    };
    writeBusinesses([...readBusinesses(), newBusiness]);

    const newUser = {
      id: 'user-' + Date.now(),
      name,
      email,
      password,
      role: 'owner',
      businessId,
    };
    writeUsers([...users, newUser]);

    localStorage.setItem(SESSION_KEY, newUser.id);
    setUser(publicUser(newUser));
    return { ok: true };
  };

  const login = ({ email, password }) => {
    const users = readUsers();
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found || found.password !== password) {
      return { ok: false, error: 'Correo o contraseña incorrectos.' };
    }
    localStorage.setItem(SESSION_KEY, found.id);
    const publicFound = publicUser(found);
    setUser(publicFound);
    return { ok: true, user: publicFound };
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  // --- Gestión de empleados (Fase 7) ---
  // Solo tiene sentido si lo invoca un 'owner': el empleado creado queda
  // atado al mismo businessId del owner que lo crea. La UI (Dashboard) es
  // responsable de no mostrar esta acción a quien no sea owner; en un
  // backend real, además, debe validarse el rol del solicitante server-side.
  const createEmployee = ({ name, email, password }) => {
    if (!user || user.role !== 'owner') {
      return { ok: false, error: 'Solo el propietario del negocio puede crear empleados.' };
    }
    const users = readUsers();
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return { ok: false, error: 'Ya existe una cuenta con este correo.' };
    }
    const newEmployee = {
      id: 'user-' + Date.now(),
      name,
      email,
      password,
      role: 'employee',
      businessId: user.businessId,
    };
    writeUsers([...users, newEmployee]);
    return { ok: true, user: publicUser(newEmployee) };
  };

  const listEmployees = () => {
    if (!user || !user.businessId) return [];
    return readUsers()
      .filter((u) => u.businessId === user.businessId && u.role === 'employee')
      .map(publicUser);
  };

  // --- Utilidades exclusivas del panel 'master' ---
  const listAllBusinesses = () => {
    if (!user || user.role !== 'master') return [];
    return readBusinesses();
  };

  const listAllUsers = () => {
    if (!user || user.role !== 'master') return [];
    return readUsers().map(publicUser);
  };

  const business = useMemo(() => {
    if (!user || !user.businessId) return null;
    return readBusinesses().find((b) => b.id === user.businessId) || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.businessId]);

  const value = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
