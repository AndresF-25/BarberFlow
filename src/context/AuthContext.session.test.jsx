/**
 * Sesión del cliente (AuthContext): qué hace al arrancar con un token guardado cuando /auth/me falla.
 * No necesita API ni base de datos: `api.me` está simulada.
 *
 * Regla (H11, corregido): solo un 401 descarta la sesión. Cualquier otro fallo (red caída, API
 * reiniciándose, 429, 5xx) conserva el token y avisa con `connectionError` para poder reintentar.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import ProtectedRoute from '../routes/ProtectedRoute';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { me: vi.fn() },
  getToken: () => localStorage.getItem('barberflow_token'),
  setToken: (t) => (t ? localStorage.setItem('barberflow_token', t) : localStorage.removeItem('barberflow_token')),
}));

function Estado() {
  const { user, loading, connectionError } = useAuth();
  if (loading) return <p>cargando</p>;
  if (connectionError) return <p>sin conexión</p>;
  return <p>{user ? `sesión de ${user.name}` : 'sin sesión'}</p>;
}

const montar = () => render(<AuthProvider><Estado /></AuthProvider>);
const error = (mensaje, status) => Object.assign(new Error(mensaje), status ? { status } : {});
const usuario = { user: { id: '1', name: 'Andrés' }, business: { id: 'b' } };
const token = () => localStorage.getItem('barberflow_token');

describe('AuthContext · restaurar la sesión al arrancar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('sin token guardado: no llama a la API y queda sin sesión', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('sin sesión')).toBeInTheDocument());
    expect(api.me).not.toHaveBeenCalled();
  });

  it('con token válido: restaura el usuario', async () => {
    localStorage.setItem('barberflow_token', 'token-bueno');
    api.me.mockResolvedValue(usuario);
    montar();
    await waitFor(() => expect(screen.getByText('sesión de Andrés')).toBeInTheDocument());
    expect(token()).toBe('token-bueno');
  });

  it('401 (token inválido o caducado): descarta el token y queda sin sesión', async () => {
    localStorage.setItem('barberflow_token', 'token-caducado');
    api.me.mockRejectedValue(error('Token inválido o expirado.', 401));
    montar();
    await waitFor(() => expect(screen.getByText('sin sesión')).toBeInTheDocument());
    expect(token()).toBeNull();
  });

  it('H11 corregido: un fallo de RED no borra un token válido y se avisa con connectionError', async () => {
    localStorage.setItem('barberflow_token', 'token-bueno');
    api.me.mockRejectedValue(new TypeError('Failed to fetch'));
    montar();
    await waitFor(() => expect(screen.getByText('sin conexión')).toBeInTheDocument());
    expect(token()).toBe('token-bueno');
  });

  it.each([500, 502, 503, 429, 403])('H11 corregido: un %i al arrancar tampoco borra el token', async (status) => {
    localStorage.setItem('barberflow_token', 'token-bueno');
    api.me.mockRejectedValue(error('El servidor no responde.', status));
    montar();
    await waitFor(() => expect(screen.getByText('sin conexión')).toBeInTheDocument());
    expect(token()).toBe('token-bueno');
  });

  it('al reintentar con la red de vuelta, la sesión se restaura sin volver a iniciar sesión', async () => {
    localStorage.setItem('barberflow_token', 'token-bueno');
    api.me.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(usuario);
    function Reintento() {
      const { retrySession } = useAuth();
      return <button onClick={retrySession}>reintentar</button>;
    }
    render(<AuthProvider><Estado /><Reintento /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('sin conexión')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'reintentar' }));
    await waitFor(() => expect(screen.getByText('sesión de Andrés')).toBeInTheDocument());
    expect(token()).toBe('token-bueno');
  });

  it('reintenta sola cuando el navegador avisa de que volvió la conexión (evento online)', async () => {
    localStorage.setItem('barberflow_token', 'token-bueno');
    api.me.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(usuario);
    montar();
    await waitFor(() => expect(screen.getByText('sin conexión')).toBeInTheDocument());
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(screen.getByText('sesión de Andrés')).toBeInTheDocument());
  });

  it('si al reintentar el servidor responde 401, ahora sí se cierra la sesión', async () => {
    localStorage.setItem('barberflow_token', 'token-bueno');
    api.me.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockRejectedValue(error('Sesión inválida.', 401));
    montar();
    await waitFor(() => expect(screen.getByText('sin conexión')).toBeInTheDocument());
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(screen.getByText('sin sesión')).toBeInTheDocument());
    expect(token()).toBeNull();
  });
});

describe('ProtectedRoute · con la sesión sin verificar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const app = () => render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>pantalla de login</p>} />
          <Route path="/dashboard" element={<ProtectedRoute><p>panel privado</p></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

  it('con un fallo de red muestra «No pudimos conectar» y NO manda a /login', async () => {
    localStorage.setItem('barberflow_token', 'token-bueno');
    api.me.mockRejectedValue(new TypeError('Failed to fetch'));
    app();
    expect(await screen.findByText('No pudimos conectar con el servidor')).toBeInTheDocument();
    expect(screen.queryByText('pantalla de login')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(token()).toBe('token-bueno');
  });

  it('el botón «Reintentar» abre el panel cuando el servidor vuelve', async () => {
    localStorage.setItem('barberflow_token', 'token-bueno');
    api.me.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(usuario);
    app();
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('panel privado')).toBeInTheDocument();
  });

  it('con un 401 sí redirige a /login', async () => {
    localStorage.setItem('barberflow_token', 'token-caducado');
    api.me.mockRejectedValue(error('Token inválido o expirado.', 401));
    app();
    expect(await screen.findByText('pantalla de login')).toBeInTheDocument();
  });
});
