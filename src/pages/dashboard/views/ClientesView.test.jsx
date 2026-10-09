/**
 * Vista Clientes: fechas legibles (U9), «Último servicio» vs «favorito», búsqueda, edición de la ficha (U10)
 * y accesibilidad. La API se simula.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../api/client', () => ({
  api: { listClients: vi.fn(), getClient: vi.fn(), updateClient: vi.fn() },
}));
import { api } from '../../../api/client';
import { ClientesView } from './ClientesView';

const clientes = [
  { id: 'c1', nombre: 'Sebastián Rojas', telefono: '3001110010', notas: 'Prefiere tijera', ultima: '2026-10-07', frecuencia: 'Cada 10 días', ultimoServicio: 'Fade con degradado', favorito: 'Fade con degradado', gasto: 38000, visitas: 16, etiqueta: 'VIP' },
  { id: 'c2', nombre: 'Esteban Cruz', telefono: '3001110014', notas: '', ultima: '2026-08-24', frecuencia: 'Cada 4 semanas', ultimoServicio: 'Corte y barba', favorito: 'Corte clásico', gasto: 40000, visitas: 3, etiqueta: 'Inactivo' },
  { id: 'c3', nombre: 'Pablo Duarte', telefono: '—', notas: '', ultima: '—', frecuencia: '—', ultimoServicio: '—', favorito: '—', gasto: 0, visitas: 0, etiqueta: 'Nuevo' },
];
const historial = [
  { fecha: '2026-10-07', servicio: 'Fade con degradado', barbero: 'Julián Patiño', valor: 38000, tipo: 'servicio' },
  { fecha: '2026-09-27', servicio: 'Cera mate', barbero: '—', valor: 28000, tipo: 'producto' },
];

const montar = async (props = {}) => {
  const user = userEvent.setup();
  render(<ClientesView {...props} />);
  await screen.findByText('Sebastián Rojas');
  return user;
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listClients.mockResolvedValue({ clients: clientes });
  api.getClient.mockResolvedValue({ client: clientes[0], historial });
  api.updateClient.mockImplementation(async (id, body) => ({ client: { ...clientes.find(c => c.id === id), nombre: body.name, notas: body.notes, telefono: body.phone || '—' } }));
});

describe('lista', () => {
  it('«Última visita» se ve como «7 oct 2026», no como 2026-10-07 (nota del módulo 0)', async () => {
    await montar();
    expect(screen.getByText('7 oct 2026')).toBeInTheDocument();
    expect(screen.getByText('24 ago 2026')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/2026-10-07/);
  });

  it('la columna «Último servicio» muestra el último, no el favorito', async () => {
    await montar();
    expect(screen.getByText('Corte y barba')).toBeInTheDocument(); // último de Esteban (su favorito es otro)
  });

  it('un cliente sin visitas muestra «—» y la etiqueta «Nuevo»', async () => {
    await montar();
    const fila = screen.getByText('Pablo Duarte').closest('tr');
    expect(within(fila).getByText('Nuevo')).toBeInTheDocument();
    expect(within(fila).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('resume cuántos clientes hay y cuántos con el filtro', async () => {
    const user = await montar();
    expect(screen.getByText('3 clientes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'VIP' }));
    expect(screen.getByText('1 cliente con este filtro')).toBeInTheDocument();
    expect(screen.queryByText('Esteban Cruz')).toBeNull();
  });

  it('los filtros de etiqueta indican cuál está activo (aria-pressed)', async () => {
    const user = await montar();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Inactivo' }));
    expect(screen.getByRole('button', { name: 'Inactivo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('cada botón «Ver historial» dice de quién es', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Ver historial de Sebastián Rojas' })).toBeInTheDocument();
  });

  it('buscar espera 300 ms y pide la búsqueda al servidor (él ignora tildes y mayúsculas)', async () => {
    const user = await montar();
    await user.type(screen.getByRole('textbox', { name: /Buscar cliente/ }), 'sebastian');
    await vi.waitFor(() => expect(api.listClients).toHaveBeenLastCalledWith({ search: 'sebastian' }));
  });

  it('sin clientes invita a registrar la primera cita', async () => {
    api.listClients.mockResolvedValue({ clients: [] });
    render(<ClientesView />);
    expect(await screen.findByText(/Todavía no tienes clientes/)).toBeInTheDocument();
  });

  it('si falla la carga muestra el error', async () => {
    api.listClients.mockRejectedValue(new Error('Sin conexión'));
    render(<ClientesView />);
    expect(await screen.findByText('No se pudieron cargar los clientes: Sin conexión')).toBeInTheDocument();
  });
});

describe('perfil del cliente', () => {
  const abrir = async (user, nombre = 'Sebastián Rojas') => {
    await user.click(screen.getByRole('button', { name: `Ver historial de ${nombre}` }));
    return screen.findByRole('dialog');
  };

  it('muestra los datos con fechas legibles, las notas y el historial (servicio y producto)', async () => {
    const user = await montar();
    const d = within(await abrir(user));
    expect(d.getByText('Servicio favorito')).toBeInTheDocument();
    expect(d.getByText('Cada 10 días')).toBeInTheDocument();
    expect(d.getByText('Prefiere tijera')).toBeInTheDocument();
    expect(await d.findByText(/7 oct 2026 · Julián Patiño/)).toBeInTheDocument();
    expect(d.getByText(/27 sep 2026 · Producto/)).toBeInTheDocument();
    expect(d.getByRole('heading', { name: 'Historial' })).toBeInTheDocument();
  });

  it('el botón de WhatsApp usa el 57 con 10 dígitos; sin teléfono queda desactivado', async () => {
    const user = await montar();
    let d = within(await abrir(user));
    expect(d.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/573001110010');
    await user.keyboard('{Escape}');
    api.getClient.mockResolvedValue({ client: clientes[2], historial: [] });
    d = within(await abrir(user, 'Pablo Duarte'));
    expect(d.getByRole('button', { name: /Sin teléfono para contactar/ })).toBeDisabled();
    expect(await d.findByText('Este cliente todavía no tiene servicios finalizados.')).toBeInTheDocument();
  });

  it('un barbero no ve «Editar ficha»', async () => {
    const user = await montar({ esOwner: false });
    const d = within(await abrir(user));
    expect(d.queryByRole('button', { name: /Editar ficha/ })).toBeNull();
  });

  it('el dueño edita nombre, teléfono y notas; la fila y el perfil se actualizan', async () => {
    const user = await montar({ esOwner: true });
    const d = within(await abrir(user));
    await user.click(d.getByRole('button', { name: /Editar ficha/ }));
    const nombre = d.getByRole('textbox', { name: 'Nombre' });
    expect(nombre).toHaveValue('Sebastián Rojas');
    await user.clear(nombre);
    await user.type(nombre, 'Sebastián Rojas Díaz');
    await user.clear(d.getByRole('textbox', { name: 'Notas' }));
    await user.type(d.getByRole('textbox', { name: 'Notas' }), 'Alérgico al mentol');
    await user.click(d.getByRole('button', { name: 'Guardar ficha' }));
    expect(api.updateClient).toHaveBeenCalledWith('c1', { name: 'Sebastián Rojas Díaz', phone: '3001110010', notes: 'Alérgico al mentol' });
    expect(await d.findByRole('status')).toHaveTextContent('Ficha actualizada.');
    expect(d.getByText('Alérgico al mentol')).toBeInTheDocument();
    expect(screen.getAllByText('Sebastián Rojas Díaz').length).toBeGreaterThan(0);
  });

  it.each([
    ['nombre vacío', { nombre: '' }, /Ingresa el nombre del cliente/],
    ['teléfono con letras', { telefono: 'llámame' }, /El teléfono solo puede tener/],
    ['teléfono corto', { telefono: '123' }, /El teléfono solo puede tener/],
    ['notas muy largas', { notas: 'x'.repeat(501) }, /Las notas son demasiado largas/],
  ])('%s: avisa y no llama al servidor', async (_n, valores, mensaje) => {
    const user = await montar({ esOwner: true });
    const d = within(await abrir(user));
    await user.click(d.getByRole('button', { name: /Editar ficha/ }));
    const campo = (n) => d.getByRole('textbox', { name: n });
    if ('nombre' in valores) await user.clear(campo('Nombre'));
    if ('telefono' in valores) { await user.clear(campo('Teléfono')); await user.type(campo('Teléfono'), valores.telefono); }
    if ('notas' in valores) { await user.clear(campo('Notas')); await user.click(campo('Notas')); await user.paste(valores.notas); }
    await user.click(d.getByRole('button', { name: 'Guardar ficha' }));
    expect(await d.findByRole('alert')).toHaveTextContent(mensaje);
    expect(api.updateClient).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor (teléfono repetido) y conserva lo escrito', async () => {
    api.updateClient.mockRejectedValue(new Error('Ya hay un cliente con ese teléfono.'));
    const user = await montar({ esOwner: true });
    const d = within(await abrir(user));
    await user.click(d.getByRole('button', { name: /Editar ficha/ }));
    await user.clear(d.getByRole('textbox', { name: 'Teléfono' }));
    await user.type(d.getByRole('textbox', { name: 'Teléfono' }), '3001110014');
    await user.click(d.getByRole('button', { name: 'Guardar ficha' }));
    expect(await d.findByRole('alert')).toHaveTextContent('Ya hay un cliente con ese teléfono.');
    expect(d.getByRole('textbox', { name: 'Teléfono' })).toHaveValue('3001110014');
  });

  it('Cancelar vuelve al perfil sin guardar', async () => {
    const user = await montar({ esOwner: true });
    const d = within(await abrir(user));
    await user.click(d.getByRole('button', { name: /Editar ficha/ }));
    await user.click(d.getByRole('button', { name: 'Cancelar' }));
    expect(d.getByText('Servicio favorito')).toBeInTheDocument();
    expect(api.updateClient).not.toHaveBeenCalled();
  });

  it('si falla el historial lo dice sin romper el perfil', async () => {
    api.getClient.mockRejectedValue(new Error('Cliente no encontrado.'));
    const user = await montar();
    const d = within(await abrir(user));
    expect(await d.findByText('No se pudo cargar el historial: Cliente no encontrado.')).toBeInTheDocument();
    expect(d.getByText('Servicio favorito')).toBeInTheDocument();
  });
});
