/**
 * Panel Master: errores visibles (antes se tragaban y decía «No hay negocios»), roles en español, dueño y fechas,
 * estado de los usuarios y totales que no cambian al buscar. La API se simula.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../api/client', () => ({ api: { masterBusinesses: vi.fn(), masterUsers: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Admin Master' }, logout: vi.fn(), changePassword: vi.fn() }) }));
import { api } from '../../api/client';
import MasterDashboard from './MasterDashboard';

const negocios = [
  { id: 'b1', name: 'Barbería La Navaja', createdAt: '2026-10-08T03:30:00.000Z', owner: { name: 'Andrés Morales', email: 'dueno.navaja@x.test' }, employees: 2, inactiveEmployees: 1 },
  { id: 'b2', name: 'Barbería Nueva', createdAt: '2026-09-01T15:00:00.000Z', owner: { name: 'Laura Gutiérrez', email: 'dueno.nueva@x.test' }, employees: 0, inactiveEmployees: 0 },
  { id: 'b3', name: 'Sin Dueño', createdAt: '2026-08-01T15:00:00.000Z', owner: null, employees: 1, inactiveEmployees: 0 },
];
const usuarios = [
  { id: 'u0', name: 'Admin Master', email: 'master@x.test', role: 'master', businessId: null, businessName: null, active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'u1', name: 'Andrés Morales', email: 'dueno.navaja@x.test', role: 'owner', businessId: 'b1', businessName: 'Barbería La Navaja', active: true, createdAt: '2026-02-01T00:00:00.000Z' },
  { id: 'u2', name: 'Sebastián Ortiz', email: 'sebas@x.test', role: 'employee', businessId: 'b1', businessName: 'Barbería La Navaja', active: false, createdAt: '2026-02-02T00:00:00.000Z' },
  { id: 'u3', name: 'Laura Gutiérrez', email: 'dueno.nueva@x.test', role: 'owner', businessId: 'b2', businessName: 'Barbería Nueva', active: true, createdAt: '2026-03-01T00:00:00.000Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.masterBusinesses.mockResolvedValue({ businesses: negocios, total: 3 });
  api.masterUsers.mockResolvedValue({ users: usuarios, total: 4 });
});

const tablaNegocios = () => screen.getByRole('columnheader', { name: 'Registrado' }).closest('table');
const enNegocios = (texto) => within(tablaNegocios()).getByText(texto);

const montar = async () => {
  const user = userEvent.setup();
  render(<MasterDashboard />);
  await screen.findByRole('columnheader', { name: 'Registrado' });
  await within(tablaNegocios()).findByText('Barbería La Navaja');
  return user;
};

describe('negocios', () => {
  it('muestra el dueño (nombre y correo), los empleados activos y desactivados, y la fecha de registro', async () => {
    await montar();
    const fila = enNegocios('Barbería La Navaja').closest('tr');
    expect(fila).toHaveTextContent('Andrés Morales');
    expect(fila).toHaveTextContent('dueno.navaja@x.test');
    expect(fila).toHaveTextContent('2 activos · 1 desactivado');
    expect(fila).toHaveTextContent('7 oct 2026'); // 03:30 UTC del 8 = 10:30 p. m. del 7 en Bogotá
    expect(enNegocios('Barbería Nueva').closest('tr')).toHaveTextContent('0 activos');
    expect(enNegocios('Sin Dueño').closest('tr')).toHaveTextContent('1 activo');
  });

  it('un negocio sin dueño muestra «—» y la tabla ya no enseña los uuid', async () => {
    await montar();
    expect(enNegocios('Sin Dueño').closest('tr')).toHaveTextContent('—');
    expect(screen.queryByRole('columnheader', { name: 'ID' })).toBeNull();
  });

  it('los totales salen del servidor (no del número de filas)', async () => {
    api.masterBusinesses.mockResolvedValue({ businesses: [negocios[0]], total: 40 });
    api.masterUsers.mockResolvedValue({ users: usuarios, total: 120 });
    render(<MasterDashboard />);
    expect(await screen.findByText('40')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });
});

describe('usuarios', () => {
  it('el rol sale en español y los desactivados se marcan', async () => {
    await montar();
    const tabla = screen.getByRole('columnheader', { name: 'Rol' }).closest('table');
    expect(within(tabla).getAllByText('Propietario')).toHaveLength(2);
    expect(within(tabla).getByText('Empleado')).toBeInTheDocument();
    expect(within(tabla).getByText('Administrador')).toBeInTheDocument();
    expect(within(tabla).queryByText('owner')).toBeNull();
    const sebas = within(tabla).getByText('Sebastián Ortiz').closest('tr');
    expect(sebas).toHaveTextContent('Desactivado');
    expect(within(tabla).getByText('Andrés Morales').closest('tr')).toHaveTextContent('Activo');
  });

  it('muestra el nombre del negocio de cada usuario y «—» para el master', async () => {
    await montar();
    const tabla = screen.getByRole('columnheader', { name: 'Rol' }).closest('table');
    expect(within(tabla).getByText('Admin Master').closest('tr')).toHaveTextContent('—');
    expect(within(tabla).getByText('Sebastián Ortiz').closest('tr')).toHaveTextContent('Barbería La Navaja');
  });
});

describe('búsqueda', () => {
  it('espera 300 ms, pide la búsqueda al servidor y deja los totales como están', async () => {
    const user = await montar();
    api.masterBusinesses.mockResolvedValue({ businesses: [negocios[1]], total: 3 });
    await user.type(screen.getByRole('textbox', { name: 'Buscar negocio o dueño' }), 'nueva');
    await vi.waitFor(() => expect(api.masterBusinesses).toHaveBeenLastCalledWith('nueva'));
    expect(await screen.findByText('1 de 3 negocios')).toBeInTheDocument();
    expect(screen.getByText('3', { selector: '.bd-num' })).toBeInTheDocument(); // el total sigue siendo 3
    expect(within(tablaNegocios()).queryByText('Barbería La Navaja')).toBeNull();
  });

  it('con una búsqueda activa, los usuarios son solo los de los negocios encontrados', async () => {
    const user = await montar();
    api.masterBusinesses.mockResolvedValue({ businesses: [negocios[1]], total: 3 });
    await user.type(screen.getByRole('textbox', { name: 'Buscar negocio o dueño' }), 'nueva');
    await screen.findByText('1 de 3 negocios');
    const tabla = screen.getByRole('columnheader', { name: 'Rol' }).closest('table');
    expect(within(tabla).getByText('Laura Gutiérrez')).toBeInTheDocument();
    expect(within(tabla).queryByText('Sebastián Ortiz')).toBeNull();
    expect(within(tabla).queryByText('Admin Master')).toBeNull();
  });

  it('sin coincidencias lo dice con claridad', async () => {
    const user = await montar();
    api.masterBusinesses.mockResolvedValue({ businesses: [], total: 3 });
    await user.type(screen.getByRole('textbox', { name: 'Buscar negocio o dueño' }), 'zzz');
    expect(await screen.findByText('Ningún negocio coincide con la búsqueda.')).toBeInTheDocument();
  });
});

describe('errores y vacío', () => {
  it('si falla la carga lo dice (antes mostraba «No hay negocios registrados») y permite reintentar', async () => {
    api.masterBusinesses.mockRejectedValueOnce(new Error('Sin conexión'));
    const user = userEvent.setup();
    render(<MasterDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los datos: Sin conexión');
    expect(screen.queryByText('No hay negocios registrados todavía.')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await within(tablaNegocios()).findByText('Barbería La Navaja')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sin negocios dice «No hay negocios registrados todavía»', async () => {
    api.masterBusinesses.mockResolvedValue({ businesses: [], total: 0 });
    api.masterUsers.mockResolvedValue({ users: [], total: 0 });
    render(<MasterDashboard />);
    expect(await screen.findByText('No hay negocios registrados todavía.')).toBeInTheDocument();
    expect(screen.getByText('No hay usuarios todavía.')).toBeInTheDocument();
  });

  it('el botón de la llave abre el cambio de contraseña', async () => {
    const user = await montar();
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Cambiar contraseña');
  });
});
