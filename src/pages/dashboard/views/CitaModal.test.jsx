/**
 * Modal «Nueva cita»: se puede guardar aunque se abra antes de que carguen los servicios y el equipo (U12).
 * Antes el estado nacía vacío, el desplegable mostraba la primera opción y «Guardar cita» seguía desactivado.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CitaModal } from './CitaModal';

const servicios = [{ id: 's1', nombre: 'Corte', duracion: 30 }, { id: 's2', nombre: 'Barba', duracion: 20 }];
const empleados = [{ id: 'e1', name: 'Julián' }, { id: 'e2', name: 'Camilo' }];

const props = (over = {}) => ({ servicios, empleados, esEmpleado: false, userId: 'u9', onClose: vi.fn(), onSave: vi.fn().mockResolvedValue({ ok: true }), ...over });

describe('Nueva cita', () => {
  it('guarda con el primer servicio y el primer barbero cuando abre con los datos ya cargados', async () => {
    const p = props();
    const user = userEvent.setup();
    render(<CitaModal {...p} />);
    await user.type(screen.getByRole('textbox', { name: 'Nombre del cliente' }), 'Laura');
    await user.click(screen.getByRole('button', { name: 'Guardar cita' }));
    expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ clientName: 'Laura', serviceId: 's1', employeeId: 'e1' }));
  });

  it('U12: si los servicios y el equipo llegan DESPUÉS de abrir, igual se puede guardar con lo que muestra el desplegable', async () => {
    const p = props({ servicios: [], empleados: [] });
    const user = userEvent.setup();
    const { rerender } = render(<CitaModal {...p} />);
    expect(screen.getByRole('button', { name: 'Guardar cita' })).toBeDisabled();
    expect(screen.getByText(/Primero crea al menos un servicio/)).toBeInTheDocument();
    rerender(<CitaModal {...p} servicios={servicios} empleados={empleados} />);
    await user.type(screen.getByRole('textbox', { name: 'Nombre del cliente' }), 'Laura');
    expect(screen.getByRole('button', { name: 'Guardar cita' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Guardar cita' }));
    expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 's1', employeeId: 'e1' }));
  });

  it('lo que el usuario elige manda sobre el primero', async () => {
    const p = props();
    const user = userEvent.setup();
    render(<CitaModal {...p} />);
    await user.type(screen.getByRole('textbox', { name: 'Nombre del cliente' }), 'Laura');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Servicio' }), 's2');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Barbero' }), 'e2');
    await user.click(screen.getByRole('button', { name: 'Guardar cita' }));
    expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 's2', employeeId: 'e2' }));
  });

  it('un barbero agenda siempre a su nombre (sin desplegable de barbero)', async () => {
    const p = props({ esEmpleado: true, empleados: [], userId: 'u9' });
    const user = userEvent.setup();
    render(<CitaModal {...p} />);
    expect(screen.queryByRole('combobox', { name: 'Barbero' })).toBeNull();
    await user.type(screen.getByRole('textbox', { name: 'Nombre del cliente' }), 'Laura');
    await user.click(screen.getByRole('button', { name: 'Guardar cita' }));
    expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'u9' }));
  });

  it('sin barberos avisa que primero hay que crear uno y no deja guardar', () => {
    render(<CitaModal {...props({ empleados: [] })} />);
    expect(screen.getByText(/Primero crea al menos un empleado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cita' })).toBeDisabled();
  });

  it('muestra el error del servidor y deja el modal abierto', async () => {
    const p = props({ onSave: vi.fn().mockResolvedValue({ ok: false, error: 'El barbero ya tiene una cita en ese horario.' }) });
    const user = userEvent.setup();
    render(<CitaModal {...p} />);
    await user.type(screen.getByRole('textbox', { name: 'Nombre del cliente' }), 'Laura');
    await user.click(screen.getByRole('button', { name: 'Guardar cita' }));
    expect(await screen.findByText('El barbero ya tiene una cita en ese horario.')).toBeInTheDocument();
    expect(p.onClose).not.toHaveBeenCalled();
  });
});

describe('validación del formulario (U14)', () => {
  const llenar = async (user, { nombre, telefono, fecha } = {}) => {
    if (nombre !== undefined) await user.type(screen.getByRole('textbox', { name: 'Nombre del cliente' }), nombre);
    if (telefono !== undefined) await user.type(screen.getByRole('textbox', { name: 'Teléfono' }), telefono);
    if (fecha !== undefined) { const f = screen.getByLabelText('Fecha'); await user.clear(f); await user.type(f, fecha); }
  };

  it.each([
    ['sin nombre', {}, /Ingresa el nombre del cliente/],
    ['nombre de solo espacios', { nombre: '     ' }, /Ingresa el nombre del cliente/],
    ['nombre de más de 80 caracteres', { nombre: 'A'.repeat(81) }, /demasiado largo/],
    ['teléfono con letras', { nombre: 'Ana', telefono: 'llámame' }, /El teléfono solo puede tener/],
    ['teléfono corto', { nombre: 'Ana', telefono: '123' }, /El teléfono solo puede tener/],
    ['fecha pasada', { nombre: 'Ana', fecha: '2020-01-01' }, /en el pasado/],
    ['fecha a más de un año', { nombre: 'Ana', fecha: '2099-01-01' }, /más de un año/],
  ])('%s: explica el problema y no llama al servidor', async (_n, valores, mensaje) => {
    const p = props();
    const user = userEvent.setup();
    render(<CitaModal {...p} />);
    await llenar(user, valores);
    await user.click(screen.getByRole('button', { name: 'Guardar cita' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it('Enter guarda (es un formulario) y el nombre se envía recortado', async () => {
    const p = props();
    const user = userEvent.setup();
    render(<CitaModal {...p} />);
    await user.type(screen.getByRole('textbox', { name: 'Nombre del cliente' }), '  Laura   Gómez  {Enter}');
    expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ clientName: 'Laura   Gómez' }));
  });

  it('Escape cierra sin guardar', async () => {
    const p = props();
    const user = userEvent.setup();
    render(<CitaModal {...p} />);
    await user.keyboard('{Escape}');
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onSave).not.toHaveBeenCalled();
  });
});

describe('hora inicial (U15)', () => {
  it('propone la próxima media hora, no «10:00» fijo: así el primer intento de hoy no cae en el pasado', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 15, 10)); // 3:10 p. m. hora local
    render(<CitaModal {...props()} />);
    expect(screen.getByLabelText('Hora')).toHaveValue('15:30');
    vi.useRealTimers();
  });

  it('en punto salta a la siguiente media hora; de noche se queda en 23:30', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 15, 30));
    const { unmount } = render(<CitaModal {...props()} />);
    expect(screen.getByLabelText('Hora')).toHaveValue('16:00');
    unmount();
    vi.setSystemTime(new Date(2026, 9, 8, 23, 50));
    render(<CitaModal {...props()} />);
    expect(screen.getByLabelText('Hora')).toHaveValue('23:30');
    vi.useRealTimers();
  });
});
