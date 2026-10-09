/**
 * Prueba de humo del Dashboard contra la API y la base de datos reales.
 *
 * Requiere el servidor corriendo. Ejemplo (servidor de pruebas en el puerto 3099):
 *   PORT=3099 npm run dev --prefix server
 *   VITE_API_URL=http://localhost:3099/api/v1 npm test
 *
 * Si la API no responde, la suite se omite. Los datos que crea usan correos
 * @test.local; se eliminan con `npm run test:cleanup --prefix server`.
 */
import React from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import Dashboard from './Dashboard';

const API = import.meta.env.VITE_API_URL;
const apiUp = API
  ? await fetch(API.replace('/api/v1', '/health')).then(r => r.ok).catch(() => false)
  : false;

const tag = Date.now();
const password = 'Clave1234';
const ids = {};

async function call(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Gate({ children }) {
  const { loading, user } = useAuth();
  return loading || !user ? null : children;
}

function mount(token) {
  localStorage.setItem('barberflow_token', token);
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Gate><Dashboard /></Gate>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const nav = async (user, name) => user.click(await screen.findByRole('button', { name }));

describe.skipIf(!apiUp)('Dashboard (API real)', () => {
  beforeAll(async () => {
    const owner = await call('POST', '/auth/register', { name: 'Smoke Owner', email: `smoke${tag}@test.local`, password });
    ids.ownerToken = owner.token;
    const t = owner.token;

    ids.service = (await call('POST', '/services', { nombre: 'Corte Smoke', categoria: 'Cortes', precio: 30000, duracion: 60 }, t)).service.id;
    ids.employee = (await call('POST', '/auth/employees', { name: 'Barbero Uno', email: `emp${tag}@test.local`, password }, t)).user.id;
    ids.employeeToken = (await call('POST', '/auth/login', { email: `emp${tag}@test.local`, password })).token;

    const day = tomorrow();
    const mk = async (cliente, time, phone = '') => (await call('POST', '/appointments', {
      clientName: cliente, clientPhone: phone, serviceId: ids.service, employeeId: ids.employee, appointmentDate: day, startTime: time,
    }, t)).appointment.id;
    const finalizada = await mk('Cliente Dos', '09:00', '3009998888');
    await mk('Cliente Uno', '10:00', '3001234567');
    await call('PATCH', `/appointments/${finalizada}`, { status: 'completed', paymentMethod: 'cash' }, t);

    ids.product = (await call('POST', '/products', {
      nombre: 'Cera Smoke', categoria: 'Styling', stock: 3, stockMinimo: 5, unidad: 'unidad', precioVenta: 28000, precioCosto: 15000,
    }, t)).product.id;
    await call('POST', '/product-sales', { productId: ids.product, quantity: 1, clientName: 'Cliente Tres' }, t);
  });


  it('propietario: recorre todas las pantallas con datos reales', async () => {
    const user = userEvent.setup();
    mount(ids.ownerToken);

    // Panel
    expect(await screen.findByRole('heading', { name: 'Panel General' })).toBeInTheDocument();
    expect((await screen.findAllByText('$58K')).length).toBeGreaterThan(0); // hoy: servicio 30.000 + venta 28.000
    expect(await screen.findByText('1. Corte Smoke')).toBeInTheDocument();

    // Agenda: las citas semilla son de mañana
    await nav(user, 'Citas y Agenda');
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Cliente Uno')).toBeInTheDocument();
    expect(screen.getByText('Cliente Dos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    expect(await screen.findByText('Cliente Uno')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mes' }));
    expect((await screen.findAllByText(/\d+ citas?$/)).length).toBeGreaterThan(0);

    // Clientes
    await nav(user, 'Clientes');
    expect(await screen.findByText('Cliente Tres')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Ver historial/ })[0]);
    expect(await screen.findByText('Perfil del cliente')).toBeInTheDocument();
    await user.click(document.querySelector('.fixed.inset-0.z-50.flex.justify-end')); // cerrar drawer

    // Servicios
    await nav(user, 'Servicios');
    expect((await screen.findAllByText('Corte Smoke')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('$30.000').length).toBeGreaterThan(0);

    // Ingresos
    await nav(user, 'Ingresos');
    expect(await screen.findByText('Ticket promedio')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('$30.000').length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: 'Mes' }));
    await waitFor(() => expect(screen.getByText(/Tendencia de ingresos — Mes/)).toBeInTheDocument());

    // Métricas
    await nav(user, 'Métricas');
    expect(await screen.findByText('Tasa de ocupación de la agenda')).toBeInTheDocument();
    expect((await screen.findAllByText('Corte Smoke')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Mes' }));
    await waitFor(() => expect(screen.getByText('Este mes')).toBeInTheDocument());

    // Alertas -> botón lleva a Inventario
    await nav(user, 'Alertas');
    expect(await screen.findByText('Productos con stock bajo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Revisar inventario/ }));
    expect(await screen.findByText('Catálogo de inventario')).toBeInTheDocument();
    expect(await screen.findByText('Cera Smoke')).toBeInTheDocument();

    // Ventas
    await nav(user, 'Ventas Extra');
    expect(await screen.findByText('Historial de ventas')).toBeInTheDocument();
    expect(await screen.findByText('Cliente Tres')).toBeInTheDocument();

    // Empleados
    await nav(user, 'Empleados');
    expect(await screen.findByText('Barbero Uno')).toBeInTheDocument();
  });

  it('propietario: crea un servicio desde la interfaz y queda en la base de datos', async () => {
    const user = userEvent.setup();
    mount(ids.ownerToken);
    await nav(user, 'Servicios');
    await user.click(await screen.findByRole('button', { name: /Nuevo servicio/ }));
    await user.type(screen.getByPlaceholderText('Ej. Corte Clásico'), 'Barba Smoke');
    await user.type(screen.getByPlaceholderText('35000'), '20000');
    await user.type(screen.getByPlaceholderText('30'), '30');
    await user.click(screen.getByRole('button', { name: /Guardar/ }));

    expect(await screen.findByText('Barba Smoke')).toBeInTheDocument();
    const { services } = await call('GET', '/services', null, ids.ownerToken);
    expect(services.some(s => s.nombre === 'Barba Smoke' && s.precio === 20000)).toBe(true);
  });

  it('propietario: agenda una cita desde "Nueva cita" y la API la guarda', async () => {
    const user = userEvent.setup();
    mount(ids.ownerToken);
    await screen.findByRole('heading', { name: 'Panel General' });
    await user.click(screen.getByRole('button', { name: /Nueva cita/ }));

    await user.type(await screen.findByPlaceholderText('Ej. Andrés Villa'), 'Cliente Desde UI');
    const modal = document.querySelector('.max-w-md');
    const fecha = modal.querySelector('input[type="date"]');
    const hora = modal.querySelector('input[type="time"]');
    await user.clear(fecha); await user.type(fecha, tomorrow());
    await user.clear(hora); await user.type(hora, '15:30');
    await user.click(within(modal).getByRole('button', { name: 'Guardar cita' }));

    await waitFor(() => expect(document.querySelector('.max-w-md')).toBeNull());
    const { appointments } = await call('GET', `/appointments?date=${tomorrow()}`, null, ids.ownerToken);
    expect(appointments.some(a => a.cliente === 'Cliente Desde UI' && a.hora === '15:30')).toBe(true);
  });

  it('propietario: una cita que se cruza muestra el error del servidor', async () => {
    const user = userEvent.setup();
    mount(ids.ownerToken);
    await screen.findByRole('heading', { name: 'Panel General' });
    await user.click(screen.getByRole('button', { name: /Nueva cita/ }));

    await user.type(await screen.findByPlaceholderText('Ej. Andrés Villa'), 'Choca');
    const modal = document.querySelector('.max-w-md');
    const fecha = modal.querySelector('input[type="date"]');
    const hora = modal.querySelector('input[type="time"]');
    await user.clear(fecha); await user.type(fecha, tomorrow());
    await user.clear(hora); await user.type(hora, '10:30'); // cruza con Cliente Uno (10:00-11:00)
    await user.click(within(modal).getByRole('button', { name: 'Guardar cita' }));

    expect(await screen.findByText(/ya tiene una cita en ese horario/)).toBeInTheDocument();
  });

  it('propietario: registra una venta desde la interfaz y baja el stock', async () => {
    const user = userEvent.setup();
    mount(ids.ownerToken);
    await nav(user, 'Ventas Extra');
    await user.click(await screen.findByRole('button', { name: /Registrar venta/ }));
    const modal = document.querySelector('.max-w-md');
    await user.click(within(modal).getByRole('button', { name: /Registrar venta/ }));

    await waitFor(() => expect(document.querySelector('.max-w-md')).toBeNull());
    const { products } = await call('GET', '/products', null, ids.ownerToken);
    expect(products.find(p => p.id === ids.product).stock).toBe(1); // 3 - 1 (semilla) - 1 (UI)
  });

  it('propietario: edita y elimina un servicio desde la interfaz', async () => {
    const t = ids.ownerToken;
    await call('POST', '/services', { nombre: 'Servicio Editable', categoria: 'Cortes', precio: 10000, duracion: 20 }, t);
    const user = userEvent.setup();
    mount(t);
    await nav(user, 'Servicios');
    let row = (await screen.findByText('Servicio Editable')).closest('tr');

    await user.click(within(row).getByTitle('Editar'));
    const precio = screen.getByPlaceholderText('35000');
    await user.clear(precio); await user.type(precio, '15000');
    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(within(screen.getByText('Servicio Editable').closest('tr')).getByText('$15.000')).toBeInTheDocument());
    let { services } = await call('GET', '/services', null, t);
    expect(services.find(s => s.nombre === 'Servicio Editable').precio).toBe(15000);

    row = screen.getByText('Servicio Editable').closest('tr');
    await user.click(within(row).getByTitle('Eliminar'));
    await user.click(within(document.querySelector('.max-w-sm')).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.queryByText('Servicio Editable')).toBeNull());
    ({ services } = await call('GET', '/services', null, t));
    expect(services.some(s => s.nombre === 'Servicio Editable')).toBe(false);
  });

  it('propietario: crea, edita (con ajuste de stock) y elimina un producto desde la interfaz', async () => {
    const t = ids.ownerToken;
    const user = userEvent.setup();
    mount(t);
    await nav(user, 'Inventario');

    // crear
    await user.click(await screen.findByRole('button', { name: /Nuevo producto/ }));
    await user.type(screen.getByPlaceholderText('Ej. Cera mate'), 'Gel Smoke');
    await user.type(screen.getByPlaceholderText('10'), '10');
    await user.type(screen.getByPlaceholderText('5'), '2');
    await user.type(screen.getByPlaceholderText('28000'), '18000');
    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    let row = (await screen.findByText('Gel Smoke')).closest('tr');
    let { products } = await call('GET', '/products', null, t);
    const id = products.find(p => p.nombre === 'Gel Smoke').id;
    expect(products.find(p => p.id === id).stock).toBe(10);

    // editar: cambiar stock 10 -> 4 y el precio
    await user.click(within(row).getByTitle('Editar'));
    const stock = screen.getByPlaceholderText('10');
    await user.clear(stock); await user.type(stock, '4');
    const venta = screen.getByPlaceholderText('28000');
    await user.clear(venta); await user.type(venta, '20000');
    await user.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(within(screen.getByText('Gel Smoke').closest('tr')).getByText('$20.000')).toBeInTheDocument());
    ({ products } = await call('GET', '/products', null, t));
    expect(products.find(p => p.id === id)).toMatchObject({ stock: 4, precioVenta: 20000 });

    // eliminar
    row = screen.getByText('Gel Smoke').closest('tr');
    await user.click(within(row).getByTitle('Eliminar'));
    await user.click(within(document.querySelector('.max-w-sm')).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.queryByText('Gel Smoke')).toBeNull());
    ({ products } = await call('GET', '/products', null, t));
    expect(products.some(p => p.id === id)).toBe(false);
  });

  it('propietario: confirma, finaliza (con método de pago) y cancela citas desde la agenda', async () => {
    const t = ids.ownerToken;
    const mk = async (cliente, time) => call('POST', '/appointments', {
      clientName: cliente, serviceId: ids.service, employeeId: ids.employee, appointmentDate: tomorrow(), startTime: time,
    }, t);
    await mk('Cliente Confirma', '12:00');
    await mk('Cliente Final', '13:30');
    await mk('Cliente Cancela', '18:00');

    const user = userEvent.setup();
    mount(t);
    await nav(user, 'Citas y Agenda');
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
    const rowOf = async (nombre) => (await screen.findByText(nombre)).closest('.bd-row');
    const estadoApi = async (nombre) => (await call('GET', `/appointments?date=${tomorrow()}`, null, t)).appointments.find(a => a.cliente === nombre).estado;

    await user.click(within(await rowOf('Cliente Confirma')).getByTitle('Confirmar'));
    await waitFor(async () => expect(await estadoApi('Cliente Confirma')).toBe('Confirmada'));

    await user.click(within(await rowOf('Cliente Final')).getByTitle('Finalizar y cobrar'));
    await user.click(await screen.findByRole('button', { name: 'Tarjeta' }));
    await waitFor(async () => expect(await estadoApi('Cliente Final')).toBe('Finalizada'));

    await user.click(within(await rowOf('Cliente Cancela')).getByTitle('Cancelar'));
    await user.click(await screen.findByRole('button', { name: 'Cancelar cita' })); // diálogo de confirmación
    await waitFor(async () => expect(await estadoApi('Cliente Cancela')).toBe('Cancelada'));

    // las citas finalizadas/canceladas ya no ofrecen acciones
    await waitFor(async () => expect(within(await rowOf('Cliente Final')).queryByTitle('Cancelar')).toBeNull());
  });

  it('propietario: crea un empleado desde la interfaz', async () => {
    const user = userEvent.setup();
    mount(ids.ownerToken);
    await nav(user, 'Empleados');
    await user.click(await screen.findByRole('button', { name: /Nuevo empleado/ }));
    const modal = document.querySelector('.max-w-sm');
    await user.type(modal.querySelector('input:not([type])'), 'Barbero Dos');
    await user.type(modal.querySelector('input[type="email"]'), `dos${tag}@test.local`);
    await user.type(modal.querySelector('input[type="password"]'), password);
    await user.click(within(modal).getByRole('button', { name: 'Crear empleado' }));

    expect(await screen.findByText('Barbero Dos')).toBeInTheDocument();
    const { employees } = await call('GET', '/auth/employees', null, ids.ownerToken);
    expect(employees.some(e => e.name === 'Barbero Dos')).toBe(true);
  });

  it('empleado: no ve ingresos ni inventario, pero sí ventas', async () => {
    mount(ids.employeeToken);
    expect(await screen.findByRole('heading', { name: 'Panel General' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ingresos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Inventario' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Empleados' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ventas Extra' })).toBeInTheDocument();
    expect(screen.queryByText('Ingresos de hoy')).toBeNull();
    await waitFor(() => expect(screen.getByText('Servicios más solicitados')).toBeInTheDocument());
  });
});
