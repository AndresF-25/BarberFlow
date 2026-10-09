/**
 * Vista Servicios: etiquetas honestas (U4), formulario validado y accesible, avisos del servidor (H30/H31).
 * Sin API: onAdd/onEdit/onDelete son simulados.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiciosView } from './ServiciosView';

const catalogo = [
  { id: 'a', nombre: 'Corte clásico', categoria: 'Cortes', precio: 30000, duracion: 45, veces: 10 },
  { id: 'b', nombre: 'Perfilado de barba', categoria: 'Barba', precio: 25000, duracion: 30, veces: 4 },
  { id: 'c', nombre: 'Servicio sin uso', categoria: 'Otros', precio: 50000, duracion: 60, veces: 0 },
];

const montar = (over = {}) => {
  const props = {
    servicios: catalogo,
    onAdd: vi.fn().mockResolvedValue({ ok: true }),
    onEdit: vi.fn().mockResolvedValue({ ok: true, scheduleConflicts: 0 }),
    onDelete: vi.fn().mockResolvedValue({ ok: true, pendingAppointments: 0 }),
    ...over,
  };
  render(<ServiciosView {...props} />);
  return { user: userEvent.setup(), ...props };
};

const dialogo = () => screen.getByRole('dialog');

describe('indicadores y tabla (U4)', () => {
  it('«Más realizado» no dice «este mes»: el contador es acumulado', () => {
    montar();
    expect(screen.getByText('Más realizado')).toBeInTheDocument();
    expect(screen.getByText('10 veces en total')).toBeInTheDocument();
    expect(screen.queryByText(/este mes/)).toBeNull();
  });

  it('el ingreso se presenta como estimado (veces × precio actual)', () => {
    montar();
    expect(screen.getByText('Ingreso estimado por servicios')).toBeInTheDocument();
    expect(screen.getByText('$400K')).toBeInTheDocument(); // 10×30.000 + 4×25.000
  });

  it('con el catálogo vacío el ingreso es $0 (antes mostraba $1) y se invita a crear el primero', () => {
    montar({ servicios: [] });
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.queryByText('$1')).toBeNull();
    expect(screen.getByText(/Crea el primero con «Nuevo servicio»/)).toBeInTheDocument();
  });

  it('sin ningún servicio finalizado no inventa un «más realizado»', () => {
    montar({ servicios: catalogo.map(s => ({ ...s, veces: 0 })) });
    expect(screen.getByText('Aún no hay servicios finalizados')).toBeInTheDocument();
  });

  it('las columnas se llaman «Realizados» y «Peso en ingresos» (no «Solicitudes» ni «Rentabilidad»)', () => {
    montar();
    expect(screen.getByRole('columnheader', { name: 'Realizados' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Peso en ingresos' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Rentabilidad' })).toBeNull();
  });

  it('cada botón de acción dice sobre qué servicio actúa', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Editar Corte clásico' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Perfilado de barba' })).toBeInTheDocument();
  });

  it('un barbero (solo lectura) ve el catálogo sin botones de edición', () => {
    montar({ readOnly: true });
    expect(screen.getByRole('cell', { name: 'Corte clásico' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuevo servicio/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Editar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Eliminar/ })).toBeNull();
  });
});

describe('formulario', () => {
  it('es un diálogo accesible con los campos nombrados', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: /Nuevo servicio/ }));
    const d = within(dialogo());
    expect(dialogo()).toHaveAccessibleName('Nuevo servicio');
    expect(d.getByRole('textbox', { name: 'Nombre del servicio' })).toBeInTheDocument();
    expect(d.getByRole('combobox', { name: 'Categoría' })).toBeInTheDocument();
    expect(d.getByRole('spinbutton', { name: 'Precio (COP)' })).toBeInTheDocument();
    expect(d.getByRole('spinbutton', { name: 'Duración (min)' })).toBeInTheDocument();
  });

  it('Enter en un campo guarda (es un formulario de verdad)', async () => {
    const { user, onAdd } = montar();
    await user.click(screen.getByRole('button', { name: /Nuevo servicio/ }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del servicio' }), 'Afeitado');
    await user.type(screen.getByRole('spinbutton', { name: 'Precio (COP)' }), '32000');
    await user.type(screen.getByRole('spinbutton', { name: 'Duración (min)' }), '45{Enter}');
    expect(onAdd).toHaveBeenCalledWith({ nombre: 'Afeitado', categoria: 'Cortes', precio: 32000, duracion: 45 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['sin nombre', { nombre: '', precio: '1000', duracion: '30' }, /Ingresa el nombre del servicio/],
    ['solo espacios', { nombre: '   ', precio: '1000', duracion: '30' }, /Ingresa el nombre del servicio/],
    ['precio con decimales', { nombre: 'X', precio: '1000.5', duracion: '30' }, /número entero de pesos/],
    ['precio vacío', { nombre: 'X', precio: '', duracion: '30' }, /número entero de pesos/],
    ['precio enorme', { nombre: 'X', precio: '99999999', duracion: '30' }, /demasiado alto/],
    ['duración cero', { nombre: 'X', precio: '1000', duracion: '0' }, /mayor que cero/],
    ['duración enorme', { nombre: 'X', precio: '1000', duracion: '601' }, /demasiado larga/],
  ])('%s: explica el problema y no llama al servidor', async (_n, valores, mensaje) => {
    const { user, onAdd } = montar();
    await user.click(screen.getByRole('button', { name: /Nuevo servicio/ }));
    const d = within(dialogo());
    if (valores.nombre) await user.type(d.getByRole('textbox', { name: 'Nombre del servicio' }), valores.nombre);
    if (valores.precio) await user.type(d.getByRole('spinbutton', { name: 'Precio (COP)' }), valores.precio);
    if (valores.duracion) await user.type(d.getByRole('spinbutton', { name: 'Duración (min)' }), valores.duracion);
    await user.click(d.getByRole('button', { name: /Guardar/ }));
    expect(await d.findByRole('alert')).toHaveTextContent(mensaje);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('el precio 0 es válido (cortesía)', async () => {
    const { user, onAdd } = montar();
    await user.click(screen.getByRole('button', { name: /Nuevo servicio/ }));
    const d = within(dialogo());
    await user.type(d.getByRole('textbox', { name: 'Nombre del servicio' }), 'Cortesía');
    await user.type(d.getByRole('spinbutton', { name: 'Precio (COP)' }), '0');
    await user.type(d.getByRole('spinbutton', { name: 'Duración (min)' }), '15');
    await user.click(d.getByRole('button', { name: /Guardar/ }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ precio: 0 }));
  });

  it('muestra el error del servidor (p. ej. nombre repetido) y deja el formulario abierto con lo escrito', async () => {
    const onAdd = vi.fn().mockResolvedValue({ ok: false, error: 'Ya existe un servicio con ese nombre.' });
    const { user } = montar({ onAdd });
    await user.click(screen.getByRole('button', { name: /Nuevo servicio/ }));
    const d = within(dialogo());
    await user.type(d.getByRole('textbox', { name: 'Nombre del servicio' }), 'Corte clásico');
    await user.type(d.getByRole('spinbutton', { name: 'Precio (COP)' }), '30000');
    await user.type(d.getByRole('spinbutton', { name: 'Duración (min)' }), '45');
    await user.click(d.getByRole('button', { name: /Guardar/ }));
    expect(await d.findByRole('alert')).toHaveTextContent('Ya existe un servicio con ese nombre.');
    expect(d.getByRole('textbox', { name: 'Nombre del servicio' })).toHaveValue('Corte clásico');
  });

  it('editar precarga los valores y conserva una categoría que ya no está en la lista', async () => {
    const { user, onEdit } = montar();
    await user.click(screen.getByRole('button', { name: 'Editar Servicio sin uso' }));
    const d = within(dialogo());
    expect(d.getByRole('textbox', { name: 'Nombre del servicio' })).toHaveValue('Servicio sin uso');
    expect(d.getByRole('combobox', { name: 'Categoría' })).toHaveValue('Otros');
    await user.clear(d.getByRole('spinbutton', { name: 'Precio (COP)' }));
    await user.type(d.getByRole('spinbutton', { name: 'Precio (COP)' }), '55000');
    await user.click(d.getByRole('button', { name: /Guardar/ }));
    expect(onEdit).toHaveBeenCalledWith('c', { nombre: 'Servicio sin uso', categoria: 'Otros', precio: 55000, duracion: 60 });
  });

  it('Escape cierra el formulario sin guardar', async () => {
    const { user, onAdd } = montar();
    await user.click(screen.getByRole('button', { name: /Nuevo servicio/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('avisos del servidor', () => {
  it('H31: alargar un servicio avisa de los cruces de horario que provoca', async () => {
    const onEdit = vi.fn().mockResolvedValue({ ok: true, scheduleConflicts: 2 });
    const { user } = montar({ onEdit });
    await user.click(screen.getByRole('button', { name: 'Editar Corte clásico' }));
    await user.click(within(dialogo()).getByRole('button', { name: /Guardar/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('2 citas futuras se crucen');
  });

  it('sin cruces no hay aviso', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: 'Editar Corte clásico' }));
    await user.click(within(dialogo()).getByRole('button', { name: /Guardar/ }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('H30: al eliminar con citas pendientes lo dice con el número exacto', async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: true, pendingAppointments: 3 });
    const { user } = montar({ onDelete });
    await user.click(screen.getByRole('button', { name: 'Eliminar Corte clásico' }));
    await user.click(within(dialogo()).getByRole('button', { name: 'Eliminar' }));
    expect(onDelete).toHaveBeenCalledWith('a');
    expect(await screen.findByRole('status')).toHaveTextContent('Le quedan 3 citas pendientes');
  });

  it('con una sola cita pendiente usa el singular; sin citas dice que el historial se conserva', async () => {
    const onDelete = vi.fn().mockResolvedValueOnce({ ok: true, pendingAppointments: 1 }).mockResolvedValueOnce({ ok: true, pendingAppointments: 0 });
    const { user } = montar({ onDelete });
    await user.click(screen.getByRole('button', { name: 'Eliminar Corte clásico' }));
    await user.click(within(dialogo()).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('1 cita pendiente');
    await user.click(screen.getByRole('button', { name: 'Eliminar Perfilado de barba' }));
    await user.click(within(dialogo()).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Su historial se conserva');
  });

  it('si eliminar falla, el error se anuncia en el diálogo y no hay aviso de éxito', async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: false, error: 'Servicio no encontrado.' });
    const { user } = montar({ onDelete });
    await user.click(screen.getByRole('button', { name: 'Eliminar Corte clásico' }));
    await user.click(within(dialogo()).getByRole('button', { name: 'Eliminar' }));
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Servicio no encontrado.');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
