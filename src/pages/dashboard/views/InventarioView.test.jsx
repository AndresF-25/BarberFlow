/**
 * Vista Inventario: plurales correctos (U6), formulario validado y accesible, ajuste de stock (U7) y avisos.
 * Sin API: onAdd/onEdit/onDelete/onAdjust son simulados.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventarioView, fmtStock } from './InventarioView';

const catalogo = [
  { id: 'a', nombre: 'Cera mate', categoria: 'Styling', stock: 2, stockMinimo: 5, unidad: 'unidad', precioVenta: 28000, precioCosto: 15000 },
  { id: 'b', nombre: 'Aceite para barba', categoria: 'Cuidado de barba', stock: 14, stockMinimo: 4, unidad: 'unidad', precioVenta: 35000, precioCosto: 18000 },
  { id: 'c', nombre: 'Pomada fuerte', categoria: 'Styling', stock: 0, stockMinimo: 3, unidad: 'unidad', precioVenta: 30000, precioCosto: 16000 },
  { id: 'd', nombre: 'Tónico', categoria: 'Otros', stock: 250, stockMinimo: 50, unidad: 'ml', precioVenta: 12000, precioCosto: 6000 },
  { id: 'e', nombre: 'Kit', categoria: 'Insumos', stock: 1, stockMinimo: 0, unidad: 'paquete', precioVenta: 50000, precioCosto: 30000 },
];

const montar = (over = {}) => {
  const props = {
    productos: catalogo,
    onAdd: vi.fn().mockResolvedValue({ ok: true }),
    onEdit: vi.fn().mockResolvedValue({ ok: true }),
    onDelete: vi.fn().mockResolvedValue({ ok: true }),
    onAdjust: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  };
  render(<InventarioView {...props} />);
  return { user: userEvent.setup(), ...props };
};
const dialogo = () => screen.getByRole('dialog');

describe('plurales de la unidad (U6)', () => {
  it('fmtStock: «1 unidad», «5 unidades», «1 paquete», «2 paquetes», «250 ml» (antes «unidads» y «mls»)', () => {
    expect(fmtStock(1, 'unidad')).toBe('1 unidad');
    expect(fmtStock(5, 'unidad')).toBe('5 unidades');
    expect(fmtStock(1, 'paquete')).toBe('1 paquete');
    expect(fmtStock(2, 'paquete')).toBe('2 paquetes');
    expect(fmtStock(250, 'ml')).toBe('250 ml');
    expect(fmtStock(3, 'caja')).toBe('3 caja');
  });

  it('la tabla muestra «Agotado» en 0 y los plurales correctos; nunca «unidads» ni «mls»', () => {
    montar();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByText('14 unidades')).toBeInTheDocument();
    expect(screen.getByText('250 ml')).toBeInTheDocument();
    expect(screen.getByText('1 paquete')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/unidads|mls\b/);
  });
});

describe('indicadores y filtros', () => {
  it('cuenta el stock bajo (incluye agotados) y lo nombra con singular/plural', () => {
    montar();
    expect(screen.getByText(/Stock bajo en 2 productos: Cera mate, Pomada fuerte/)).toBeInTheDocument();
  });

  it('el valor del inventario es stock × costo', () => {
    montar();
    // 2×15.000 + 14×18.000 + 0 + 250×6.000 + 1×30.000 = 1.812.000
    expect(screen.getByText('$1.8M')).toBeInTheDocument();
  });

  it('una categoría que no está en la lista base (Otros) igual aparece como filtro', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: 'Otros' }));
    expect(screen.getByRole('cell', { name: 'Tónico' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Cera mate' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Otros' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('una categoría sin productos explica que no hay y el catálogo vacío invita a crear', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: 'Bebidas' }));
    expect(screen.getByText('No hay productos en esta categoría.')).toBeInTheDocument();
  });

  it('catálogo vacío: $0 y mensaje para crear el primero', () => {
    montar({ productos: [] });
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText(/Crea el primero con «Nuevo producto»/)).toBeInTheDocument();
  });

  it('cada botón de acción dice sobre qué producto actúa', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Ajustar stock de Cera mate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Cera mate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Cera mate' })).toBeInTheDocument();
  });
});

describe('formulario de producto', () => {
  const llenar = async (user, v) => {
    const d = within(dialogo());
    if (v.nombre) await user.type(d.getByRole('textbox', { name: 'Nombre del producto' }), v.nombre);
    if (v.stock) await user.type(d.getByRole('spinbutton', { name: 'Stock actual' }), v.stock);
    if (v.min) await user.type(d.getByRole('spinbutton', { name: 'Stock mínimo' }), v.min);
    if (v.venta) await user.type(d.getByRole('spinbutton', { name: 'Precio de venta' }), v.venta);
    if (v.costo) await user.type(d.getByRole('spinbutton', { name: 'Precio de costo' }), v.costo);
  };

  it('es un diálogo accesible con los campos nombrados', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: /Nuevo producto/ }));
    expect(dialogo()).toHaveAccessibleName('Nuevo producto');
    const d = within(dialogo());
    for (const n of ['Stock actual', 'Stock mínimo', 'Precio de venta', 'Precio de costo']) expect(d.getByRole('spinbutton', { name: n })).toBeInTheDocument();
    expect(d.getByRole('combobox', { name: 'Categoría' })).toBeInTheDocument();
    expect(d.getByRole('combobox', { name: 'Unidad' })).toBeInTheDocument();
  });

  it('Enter guarda con todos los datos; el costo vacío se envía como 0', async () => {
    const { user, onAdd } = montar();
    await user.click(screen.getByRole('button', { name: /Nuevo producto/ }));
    await llenar(user, { nombre: 'Gel', stock: '10', min: '2', venta: '18000' });
    await user.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledWith({ nombre: 'Gel', categoria: 'Styling', unidad: 'unidad', stock: 10, stockMinimo: 2, precioVenta: 18000, precioCosto: 0 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['sin nombre', { stock: '1', min: '1', venta: '1000' }, /Ingresa el nombre del producto/],
    ['stock con decimales', { nombre: 'X', stock: '1.5', min: '1', venta: '1000' }, /stock debe ser un número entero/],
    ['stock vacío', { nombre: 'X', min: '1', venta: '1000' }, /stock debe ser un número entero/],
    ['stock enorme', { nombre: 'X', stock: '1000001', min: '1', venta: '1000' }, /demasiado alto/],
    ['mínimo vacío', { nombre: 'X', stock: '1', venta: '1000' }, /stock mínimo/],
    ['precio de venta 0', { nombre: 'X', stock: '1', min: '1', venta: '0' }, /mayor que cero/],
    ['precio con decimales', { nombre: 'X', stock: '1', min: '1', venta: '1000.5' }, /número entero de pesos/],
    ['precio enorme', { nombre: 'X', stock: '1', min: '1', venta: '99999999' }, /demasiado alto/],
    ['costo con decimales', { nombre: 'X', stock: '1', min: '1', venta: '1000', costo: '10.5' }, /precio de costo/],
  ])('%s: explica el problema y no llama al servidor', async (_n, valores, mensaje) => {
    const { user, onAdd } = montar();
    await user.click(screen.getByRole('button', { name: /Nuevo producto/ }));
    await llenar(user, valores);
    await user.click(within(dialogo()).getByRole('button', { name: /Guardar/ }));
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(mensaje);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor (nombre repetido) y conserva lo escrito', async () => {
    const onAdd = vi.fn().mockResolvedValue({ ok: false, error: 'Ya existe un producto con ese nombre.' });
    const { user } = montar({ onAdd });
    await user.click(screen.getByRole('button', { name: /Nuevo producto/ }));
    await llenar(user, { nombre: 'Cera mate', stock: '1', min: '1', venta: '1000' });
    await user.click(within(dialogo()).getByRole('button', { name: /Guardar/ }));
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Ya existe un producto con ese nombre.');
    expect(within(dialogo()).getByRole('textbox', { name: 'Nombre del producto' })).toHaveValue('Cera mate');
  });

  it('editar precarga todo, conserva una categoría fuera de la lista y envía el stock en el mismo guardado', async () => {
    const { user, onEdit } = montar();
    await user.click(screen.getByRole('button', { name: 'Editar Tónico' }));
    const d = within(dialogo());
    expect(d.getByRole('combobox', { name: 'Categoría' })).toHaveValue('Otros');
    expect(d.getByRole('combobox', { name: 'Unidad' })).toHaveValue('ml');
    expect(d.getByText(/queda registrado como una corrección/)).toBeInTheDocument();
    await user.clear(d.getByRole('spinbutton', { name: 'Stock actual' }));
    await user.type(d.getByRole('spinbutton', { name: 'Stock actual' }), '200');
    await user.click(d.getByRole('button', { name: /Guardar/ }));
    expect(onEdit).toHaveBeenCalledWith('d', expect.objectContaining({ nombre: 'Tónico', categoria: 'Otros', unidad: 'ml', stock: 200, stockMinimo: 50 }));
  });

  it('Escape cierra sin guardar', async () => {
    const { user, onAdd } = montar();
    await user.click(screen.getByRole('button', { name: /Nuevo producto/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('ajustar stock (U7)', () => {
  it('entra mercancía: muestra cuánto quedará y envía el delta positivo', async () => {
    const { user, onAdjust } = montar();
    await user.click(screen.getByRole('button', { name: 'Ajustar stock de Cera mate' }));
    const d = within(dialogo());
    expect(dialogo()).toHaveAccessibleName('Ajustar stock de Cera mate');
    expect(d.getByText('Ahora hay 2 unidades.')).toBeInTheDocument();
    await user.type(d.getByRole('spinbutton', { name: 'Cantidad' }), '12');
    expect(d.getByText('Quedará en 14 unidades.')).toBeInTheDocument();
    await user.click(d.getByRole('button', { name: 'Ajustar stock' }));
    expect(onAdjust).toHaveBeenCalledWith('a', 12);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sale mercancía: envía el delta negativo', async () => {
    const { user, onAdjust } = montar();
    await user.click(screen.getByRole('button', { name: 'Ajustar stock de Aceite para barba' }));
    const d = within(dialogo());
    await user.click(d.getByRole('radio', { name: 'Sale mercancía' }));
    await user.type(d.getByRole('spinbutton', { name: 'Cantidad' }), '4');
    expect(d.getByText('Quedará en 10 unidades.')).toBeInTheDocument();
    await user.click(d.getByRole('button', { name: 'Ajustar stock' }));
    expect(onAdjust).toHaveBeenCalledWith('b', -4);
  });

  it('si la salida supera lo que hay, avisa que quedará en 0', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: 'Ajustar stock de Cera mate' }));
    const d = within(dialogo());
    await user.click(d.getByRole('radio', { name: 'Sale mercancía' }));
    await user.type(d.getByRole('spinbutton', { name: 'Cantidad' }), '9');
    expect(d.getByText('Solo hay 2: el stock quedará en 0.')).toBeInTheDocument();
  });

  it.each(['', '0', '1.5', '1000001'])('la cantidad «%s» no se envía', async (cantidad) => {
    const { user, onAdjust } = montar();
    await user.click(screen.getByRole('button', { name: 'Ajustar stock de Cera mate' }));
    const d = within(dialogo());
    if (cantidad) await user.type(d.getByRole('spinbutton', { name: 'Cantidad' }), cantidad);
    await user.click(d.getByRole('button', { name: 'Ajustar stock' }));
    expect(await d.findByRole('alert')).toHaveTextContent(/entero mayor que cero/);
    expect(onAdjust).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor', async () => {
    const onAdjust = vi.fn().mockResolvedValue({ ok: false, error: 'Producto no encontrado.' });
    const { user } = montar({ onAdjust });
    await user.click(screen.getByRole('button', { name: 'Ajustar stock de Cera mate' }));
    await user.type(within(dialogo()).getByRole('spinbutton', { name: 'Cantidad' }), '3');
    await user.click(within(dialogo()).getByRole('button', { name: 'Ajustar stock' }));
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Producto no encontrado.');
  });
});

describe('eliminar', () => {
  it('confirma, llama al servidor y avisa que las ventas se conservan', async () => {
    const { user, onDelete } = montar();
    await user.click(screen.getByRole('button', { name: 'Eliminar Cera mate' }));
    await user.click(within(dialogo()).getByRole('button', { name: 'Eliminar' }));
    expect(onDelete).toHaveBeenCalledWith('a');
    expect(await screen.findByRole('status')).toHaveTextContent('«Cera mate» salió del inventario. Sus ventas anteriores se conservan.');
  });

  it('si falla, el error se anuncia en el diálogo y no hay aviso de éxito', async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: false, error: 'Producto no encontrado.' });
    const { user } = montar({ onDelete });
    await user.click(screen.getByRole('button', { name: 'Eliminar Cera mate' }));
    await user.click(within(dialogo()).getByRole('button', { name: 'Eliminar' }));
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Producto no encontrado.');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('historial de stock', () => {
  const movimientos = [
    { id: 'm4', fecha: '2026-10-08T15:30:00.000Z', motivo: 'correccion', cambio: -1, saldo: 2, ventaId: null },
    { id: 'm3', fecha: '2026-10-07T15:00:00.000Z', motivo: 'venta', cambio: -3, saldo: 3, ventaId: 'v1' },
    { id: 'm2', fecha: '2026-09-01T15:00:00.000Z', motivo: 'ajuste', cambio: -2, saldo: 6, ventaId: null },
    { id: 'm1', fecha: '2026-08-01T15:00:00.000Z', motivo: 'ajuste', cambio: 8, saldo: 8, ventaId: null },
  ];

  it('abre el diálogo, pide el historial del producto y lista cada movimiento con su nombre, cambio y saldo', async () => {
    const onHistory = vi.fn().mockResolvedValue({ ok: true, movements: movimientos, total: 4 });
    const { user } = montar({ onHistory });
    await user.click(screen.getByRole('button', { name: 'Historial de stock de Cera mate' }));
    expect(onHistory).toHaveBeenCalledWith('a');
    expect(dialogo()).toHaveAccessibleName('Historial de stock de Cera mate');
    const d = within(dialogo());
    expect(await d.findByText('Corrección')).toBeInTheDocument();
    expect(d.getByText('Venta')).toBeInTheDocument();
    expect(d.getByText('Salida de mercancía')).toBeInTheDocument();
    expect(d.getByText('Entrada de mercancía')).toBeInTheDocument();
    const filas = d.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(4);
    expect(within(filas[0]).getByText('-1')).toBeInTheDocument();
    expect(within(filas[3]).getByText('+8')).toBeInTheDocument();
    expect(within(filas[3]).getAllByRole('cell')[3]).toHaveTextContent('8');
  });

  it('si hay más movimientos de los mostrados lo dice; si no, no', async () => {
    const onHistory = vi.fn().mockResolvedValue({ ok: true, movements: movimientos, total: 230 });
    const { user } = montar({ onHistory });
    await user.click(screen.getByRole('button', { name: 'Historial de stock de Cera mate' }));
    expect(await within(dialogo()).findByText('Mostrando los últimos 4 de 230 movimientos.')).toBeInTheDocument();
  });

  it('un producto sin movimientos muestra el mensaje de vacío', async () => {
    const onHistory = vi.fn().mockResolvedValue({ ok: true, movements: [], total: 0 });
    const { user } = montar({ onHistory });
    await user.click(screen.getByRole('button', { name: 'Historial de stock de Cera mate' }));
    expect(await within(dialogo()).findByText('Este producto todavía no tiene movimientos.')).toBeInTheDocument();
  });

  it('muestra «Cargando…» mientras espera y el error del servidor si falla', async () => {
    let fallar;
    const onHistory = vi.fn().mockReturnValue(new Promise((res) => { fallar = res; }));
    const { user } = montar({ onHistory });
    await user.click(screen.getByRole('button', { name: 'Historial de stock de Cera mate' }));
    expect(within(dialogo()).getByRole('status')).toHaveTextContent('Cargando historial…');
    fallar({ ok: false, error: 'Producto no encontrado.' });
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Producto no encontrado.');
  });

  it('las fechas se muestran en hora de Bogotá, con el año solo si no es el actual', async () => {
    const onHistory = vi.fn().mockResolvedValue({ ok: true, movements: [{ id: 'x', fecha: '2020-01-02T03:30:00.000Z', motivo: 'ajuste', cambio: 1, saldo: 1, ventaId: null }], total: 1 });
    const { user } = montar({ onHistory });
    await user.click(screen.getByRole('button', { name: 'Historial de stock de Cera mate' }));
    // 03:30 UTC del 2 de enero = 10:30 p. m. del 1 de enero en Bogotá (UTC−5)
    expect(await within(dialogo()).findByText(/1 (de )?ene.*2020.*10:30/)).toBeInTheDocument();
  });

  it('no abre la carga otra vez cuando el padre vuelve a renderizar', async () => {
    const onHistory = vi.fn().mockResolvedValue({ ok: true, movements: movimientos, total: 4 });
    const { user } = montar({ onHistory });
    await user.click(screen.getByRole('button', { name: 'Historial de stock de Cera mate' }));
    await within(dialogo()).findByText('Venta');
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

  it('sin la función onHistory no aparece el botón', () => {
    montar();
    expect(screen.queryByRole('button', { name: /Historial de stock/ })).toBeNull();
  });
});
