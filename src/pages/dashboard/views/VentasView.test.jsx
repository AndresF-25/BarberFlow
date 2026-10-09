/**
 * Vista Ventas Extra: fechas legibles con hora (U17), período, formulario validado y accesible, vista del barbero.
 * Sin API: onAddVenta es simulado; «hoy» es 2026-10-08.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../api/client', () => ({ todayIso: () => '2026-10-08' }));
import { VentasView } from './VentasView';

const productos = [
  { id: 'p1', nombre: 'Cera mate', stock: 5, precioVenta: 28000 },
  { id: 'p2', nombre: 'Aceite', stock: 0, precioVenta: 35000 },
  { id: 'p3', nombre: 'Cerveza', stock: 24, precioVenta: 9000 },
];
const ventas = [
  { id: 'v1', fecha: '2026-10-08', hora: '13:00', producto: 'Cera mate', cantidad: 1, precioUnitario: 28000, total: 28000, cliente: 'Jhon Zapata', vendedor: 'Julián Patiño' },
  { id: 'v2', fecha: '2026-10-05', hora: '09:30', producto: 'Cerveza', cantidad: 3, precioUnitario: 9000, total: 27000, cliente: '', vendedor: 'Camilo Reyes' },
  { id: 'v3', fecha: '2026-09-20', hora: '17:45', producto: 'Cerveza', cantidad: 2, precioUnitario: 9000, total: 18000, cliente: '', vendedor: 'Andrés Morales' },
  { id: 'v4', fecha: '2026-07-01', hora: '10:00', producto: 'Cera mate', cantidad: 4, precioUnitario: 28000, total: 112000, cliente: '', vendedor: 'Andrés Morales' },
];

const montar = (over = {}) => {
  const props = { productos, ventas, onAddVenta: vi.fn().mockResolvedValue({ ok: true }), ...over };
  render(<VentasView {...props} />);
  return { user: userEvent.setup(), ...props };
};
const dialogo = () => screen.getByRole('dialog');

describe('historial', () => {
  it('la fecha se ve como «8 oct 2026» con la hora, no como 2026-10-08', () => {
    montar();
    const fila = screen.getByText('Jhon Zapata').closest('tr');
    expect(fila).toHaveTextContent('8 oct 2026');
    expect(fila).toHaveTextContent('13:00');
    expect(document.body.textContent).not.toMatch(/2026-10-08/);
  });

  it('por defecto muestra los últimos 30 días y los indicadores son de ese período', () => {
    montar();
    expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('En los últimos 30 días').length).toBe(3);
    expect(screen.getByText('$73K')).toBeInTheDocument(); // 28.000 + 27.000 + 18.000
    expect(screen.queryByText('1 jul 2026')).toBeNull();
  });

  it('cambiar de período filtra la tabla y los indicadores', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByText('Jhon Zapata')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2); // encabezado + 1 venta
    expect(screen.getAllByText('En hoy').length).toBe(3);
    await user.click(screen.getByRole('button', { name: '7 días' }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Todo' }));
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(screen.getByText('$185K')).toBeInTheDocument(); // todo el historial
    expect(screen.getAllByText('En todo el historial').length).toBe(3);
  });

  it('el producto más vendido sale de las unidades del período', async () => {
    const { user } = montar();
    expect(screen.getByRole('heading', { name: 'Historial de ventas' })).toBeInTheDocument();
    expect(screen.getAllByText('Cerveza').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Todo' }));
    expect(screen.getByText('Cera mate', { selector: '.bd-num' })).toBeInTheDocument(); // 5 unidades vs 5 de cerveza: empate → el primero
  });

  it('un período sin ventas lo explica y sugiere «Todo»; sin ventas nunca, invita a registrar la primera', async () => {
    const { user } = montar({ ventas: [ventas[3]] });
    expect(screen.getByText(/No hay ventas en los últimos 30 días. Prueba con «Todo»./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Todo' }));
    expect(screen.getByText('Cera mate', { selector: 'td' })).toBeInTheDocument();
  });

  it('sin ninguna venta: «Todavía no has registrado ventas»', () => {
    montar({ ventas: [] });
    expect(screen.getByText('Todavía no has registrado ventas de productos.')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('el dueño ve quién vendió; el barbero no tiene esa columna y se le aclara que ve solo las suyas', () => {
    const { unmount } = render(<VentasView productos={productos} ventas={ventas} onAddVenta={vi.fn()} esOwner />);
    expect(screen.getByRole('columnheader', { name: 'Vendió' })).toBeInTheDocument();
    expect(screen.getByText('Julián Patiño')).toBeInTheDocument();
    unmount();
    render(<VentasView productos={productos} ventas={ventas} onAddVenta={vi.fn()} esOwner={false} />);
    expect(screen.queryByRole('columnheader', { name: 'Vendió' })).toBeNull();
    expect(screen.getByText(/solo las ventas que registraste tú/)).toBeInTheDocument();
  });

  it('si falla la carga muestra el error', () => {
    montar({ ventas: [], estado: { loading: false, error: 'Sin conexión' } });
    expect(screen.getByText('No se pudieron cargar las ventas: Sin conexión')).toBeInTheDocument();
  });
});

describe('registrar una venta', () => {
  const abrir = async (user) => { await user.click(screen.getByRole('button', { name: /Registrar venta/ })); return within(dialogo()); };

  it('es un diálogo accesible; ofrece solo productos con stock y calcula el total', async () => {
    const { user } = montar();
    const d = await abrir(user);
    expect(dialogo()).toHaveAccessibleName('Registrar venta');
    expect(d.getByRole('option', { name: /Cera mate/ })).toBeInTheDocument();
    expect(d.queryByRole('option', { name: /Aceite/ })).toBeNull(); // sin stock
    await user.clear(d.getByRole('spinbutton', { name: 'Cantidad' }));
    await user.type(d.getByRole('spinbutton', { name: 'Cantidad' }), '3');
    expect(d.getByLabelText('Total de la venta')).toHaveTextContent('$84.000');
  });

  it('Enter registra con el producto elegido; el cliente se envía recortado y solo si se escribió', async () => {
    const { user, onAddVenta } = montar();
    const d = await abrir(user);
    await user.selectOptions(d.getByRole('combobox', { name: 'Producto' }), 'p3');
    await user.type(d.getByRole('textbox', { name: 'Cliente (opcional)' }), '  Laura Gómez {Enter}');
    expect(onAddVenta).toHaveBeenCalledWith({ productId: 'p3', quantity: 1, clientName: 'Laura Gómez' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sin cliente no envía clientName', async () => {
    const { user, onAddVenta } = montar();
    const d = await abrir(user);
    await user.click(d.getByRole('button', { name: /Registrar venta/ }));
    expect(onAddVenta).toHaveBeenCalledWith({ productId: 'p1', quantity: 1 });
  });

  it.each([
    ['cantidad vacía', '', /número entero, desde 1/],
    ['cantidad 0', '0', /número entero, desde 1/],
    ['cantidad con decimales', '1.5', /número entero, desde 1/],
    ['más que el stock', '6', /Solo hay 5 en stock/],
  ])('%s: explica el problema y no llama al servidor', async (_n, valor, mensaje) => {
    const { user, onAddVenta } = montar();
    const d = await abrir(user);
    await user.clear(d.getByRole('spinbutton', { name: 'Cantidad' }));
    if (valor) await user.type(d.getByRole('spinbutton', { name: 'Cantidad' }), valor);
    await user.click(d.getByRole('button', { name: /Registrar venta/ }));
    expect(await d.findByRole('alert')).toHaveTextContent(mensaje);
    expect(onAddVenta).not.toHaveBeenCalled();
  });

  it('un nombre de cliente de más de 80 caracteres se avisa', async () => {
    const { user, onAddVenta } = montar();
    const d = await abrir(user);
    await user.click(d.getByRole('textbox', { name: 'Cliente (opcional)' }));
    await user.paste('A'.repeat(81));
    await user.click(d.getByRole('button', { name: /Registrar venta/ }));
    expect(await d.findByRole('alert')).toHaveTextContent(/demasiado largo/);
    expect(onAddVenta).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor y deja el diálogo abierto', async () => {
    const onAddVenta = vi.fn().mockResolvedValue({ ok: false, error: 'Stock insuficiente.' });
    const { user } = montar({ onAddVenta });
    const d = await abrir(user);
    await user.click(d.getByRole('button', { name: /Registrar venta/ }));
    expect(await d.findByRole('alert')).toHaveTextContent('Stock insuficiente.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sin productos con stock avisa y ofrece volver', async () => {
    const { user } = montar({ productos: [productos[1]] });
    const d = await abrir(user);
    expect(d.getByText('No hay productos con stock disponible.')).toBeInTheDocument();
    await user.click(d.getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape cierra sin registrar', async () => {
    const { user, onAddVenta } = montar();
    await abrir(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onAddVenta).not.toHaveBeenCalled();
  });
});
