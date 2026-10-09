/**
 * Agenda: cancelar con un diálogo propio (no window.confirm), títulos bien escritos, accesibilidad,
 * cobro visible en las finalizadas y aviso de citas sin cerrar. La API se simula; «hoy» es 2026-10-08 (jueves).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../api/client', () => ({
  api: { listAppointments: vi.fn(), updateAppointment: vi.fn() },
  todayIso: () => '2026-10-08',
}));
import { api } from '../../../api/client';
import { AgendaView } from './AgendaView';

const cita = (over) => ({
  id: 'x', hora: '10:00', fecha: '2026-10-08', cliente: 'Carlos Gómez', telefono: '3001110001', servicio: 'Corte clásico', serviceId: 's1',
  barbero: 'Julián Patiño', employeeId: 'e1', estado: 'Pendiente', status: 'pending', clientId: 'c1', metodoPago: null, valor: null, ...over,
});
const citas = [
  cita({ id: '1', hora: '09:00', cliente: 'Ana Pérez', estado: 'Finalizada', status: 'completed', metodoPago: 'card', valor: 38000 }),
  cita({ id: '2', hora: '10:00', cliente: 'Carlos Gómez', estado: 'Pendiente', status: 'pending' }),
  cita({ id: '3', hora: '11:00', cliente: 'Luis Pardo', estado: 'Confirmada', status: 'confirmed' }),
  cita({ id: '4', hora: '12:00', cliente: 'Hugo Páez', estado: 'Cancelada', status: 'cancelled' }),
];

const montar = async (lista = citas, props = {}) => {
  api.listAppointments.mockResolvedValue({ appointments: lista });
  const onChanged = vi.fn();
  const user = userEvent.setup();
  render(<AgendaView citasVersion={0} onChanged={onChanged} {...props} />);
  await screen.findByText(lista[0]?.cliente ?? 'No hay citas para este día.');
  return { user, onChanged };
};

beforeEach(() => {
  vi.clearAllMocks();
  api.updateAppointment.mockResolvedValue({ appointment: {} });
});

describe('títulos', () => {
  it('el día se titula «Agenda — Jueves, 8 de octubre» (antes «8 De Octubre» con cada palabra en mayúscula)', async () => {
    await montar();
    expect(screen.getByRole('heading', { name: 'Agenda — Jueves, 8 de octubre' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/De Octubre/);
  });

  it('la semana se titula «Semana del 5 al 11 de octubre» y el mes «Octubre de 2026»', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    expect(await screen.findByRole('heading', { name: 'Semana del 5 al 11 de octubre' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mes' }));
    expect(await screen.findByRole('heading', { name: 'Octubre de 2026' })).toBeInTheDocument();
  });

  it('una semana que cruza de mes nombra los dos meses', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByRole('heading', { name: 'Semana del 26 de octubre al 1 de noviembre' })).toBeInTheDocument();
  });
});

describe('día', () => {
  it('las finalizadas muestran lo cobrado y cómo pagó; las demás no', async () => {
    await montar();
    expect(screen.getByText('$38.000 · Tarjeta')).toBeInTheDocument();
    expect(screen.getAllByText(/ · (Efectivo|Tarjeta|Transferencia)/)).toHaveLength(1);
  });

  it('las acciones solo existen en las abiertas y dicen sobre qué cita actúan', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Confirmar la cita de Carlos Gómez' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar la cita de Luis Pardo' })).toBeNull(); // ya confirmada
    expect(screen.getByRole('button', { name: 'Finalizar y cobrar la cita de Luis Pardo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /de Ana Pérez/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /de Hugo Páez/ })).toBeNull();
  });

  it('«Sin cerrar» solo aparece en citas abiertas de días anteriores', async () => {
    await montar([cita({ id: 'a', fecha: '2026-10-07', cliente: 'De Ayer', estado: 'Pendiente' }), cita({ id: 'b', fecha: '2026-10-07', hora: '11:00', cliente: 'Ayer Hecha', estado: 'Finalizada', status: 'completed', metodoPago: 'cash', valor: 30000 })]);
    expect(screen.getAllByText('Sin cerrar')).toHaveLength(1);
    expect(screen.getByText('De Ayer').closest('.bd-row')).toHaveTextContent('Sin cerrar');
  });

  it('una cita abierta de hoy no se marca como «Sin cerrar»', async () => {
    await montar();
    expect(screen.queryByText('Sin cerrar')).toBeNull();
  });

  it('los filtros de vista y de estado indican cuál está activo (aria-pressed)', async () => {
    const { user } = await montar();
    expect(screen.getByRole('button', { name: 'Día' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Cancelada' }));
    expect(screen.getByRole('button', { name: 'Cancelada' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Hugo Páez')).toBeInTheDocument();
    expect(screen.queryByText('Carlos Gómez')).toBeNull();
  });

  it('un día sin citas lo dice; con un filtro sin resultados también', async () => {
    const { user } = await montar([cita({ id: 'z', cliente: 'Solo Una' })]);
    await user.click(screen.getByRole('button', { name: 'Cancelada' }));
    expect(screen.getByText('No hay citas con este filtro.')).toBeInTheDocument();
  });

  it('si falla la carga muestra el error', async () => {
    api.listAppointments.mockRejectedValue(new Error('Sin conexión'));
    render(<AgendaView citasVersion={0} onChanged={() => {}} />);
    expect(await screen.findByText('No se pudieron cargar las citas: Sin conexión')).toBeInTheDocument();
  });
});

describe('cancelar (U13)', () => {
  it('abre un diálogo de confirmación propio (no window.confirm) que nombra al cliente y la hora', async () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar la cita de Carlos Gómez' }));
    const d = screen.getByRole('dialog');
    expect(d).toHaveAccessibleName('¿Cancelar la cita?');
    expect(within(d).getByText('Carlos Gómez')).toBeInTheDocument();
    expect(d).toHaveTextContent('10:00');
    expect(confirmar).not.toHaveBeenCalled();
    expect(api.updateAppointment).not.toHaveBeenCalled();
  });

  it('«Volver» y Escape cierran sin cancelar', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar la cita de Carlos Gómez' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancelar la cita de Carlos Gómez' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.updateAppointment).not.toHaveBeenCalled();
  });

  it('«Cancelar cita» cancela, avisa a la vista que recargue y cierra', async () => {
    const { user, onChanged } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar la cita de Carlos Gómez' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar cita' }));
    expect(api.updateAppointment).toHaveBeenCalledWith('2', { status: 'cancelled' });
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('si el servidor lo rechaza, el error se anuncia en el diálogo y sigue abierto', async () => {
    api.updateAppointment.mockRejectedValue(new Error('No se puede cancelar una cita finalizada.'));
    const { user, onChanged } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar la cita de Carlos Gómez' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar cita' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('No se puede cancelar una cita finalizada.');
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('confirmar y finalizar', () => {
  it('confirmar llama a la API; si falla, el error se anuncia', async () => {
    api.updateAppointment.mockRejectedValue(new Error('Cita no encontrada.'));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Confirmar la cita de Carlos Gómez' }));
    expect(api.updateAppointment).toHaveBeenCalledWith('2', { status: 'confirmed' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Cita no encontrada.');
  });

  it('finalizar pide el método de pago y lo envía', async () => {
    const { user, onChanged } = await montar();
    await user.click(screen.getByRole('button', { name: 'Finalizar y cobrar la cita de Luis Pardo' }));
    const d = screen.getByRole('dialog');
    expect(d).toHaveAccessibleName('Finalizar cita');
    await user.click(within(d).getByRole('button', { name: 'Transferencia' }));
    expect(api.updateAppointment).toHaveBeenCalledWith('3', { status: 'completed', paymentMethod: 'transfer' });
    expect(onChanged).toHaveBeenCalled();
  });

  it('si finalizar falla, el error se anuncia en el diálogo', async () => {
    api.updateAppointment.mockRejectedValue(new Error('No se puede completar una cita cancelada.'));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Finalizar y cobrar la cita de Luis Pardo' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Efectivo' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('No se puede completar una cita cancelada.');
  });
});

describe('semana y mes', () => {
  it('la semana muestra cada cita con su estado en texto (no solo el color de la borde)', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    expect(await screen.findByText('Finalizada', { selector: '.sr-only' })).toBeInTheDocument();
  });

  it('los días del mes dicen su fecha y cuántas citas tienen (las canceladas no cuentan); pulsar uno abre ese día', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Mes' }));
    const dia = await screen.findByRole('button', { name: 'Jueves, 8 de octubre: 3 citas' });
    expect(screen.getByRole('button', { name: 'Viernes, 9 de octubre: sin citas' })).toBeInTheDocument();
    await user.click(dia);
    expect(await screen.findByRole('heading', { name: 'Agenda — Jueves, 8 de octubre' })).toBeInTheDocument();
  });
});
