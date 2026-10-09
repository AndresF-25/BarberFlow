/**
 * Panel, Ingresos, Métricas y Alertas: textos que no mienten (U18), «por atender» que cuadra, tendencias con su
 * explicación, 0 % neutro, alerta «sin cerrar» y accesibilidad. La API se simula; «hoy» es 2026-10-08.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../api/client', () => ({
  api: {
    listAppointments: vi.fn(), dashboardAnalytics: vi.fn(), revenueAnalytics: vi.fn(), metricsAnalytics: vi.fn(), alertsAnalytics: vi.fn(),
  },
  todayIso: () => '2026-10-08',
}));
import { api } from '../../../api/client';
import { DashboardView } from './DashboardView';
import { IngresosView } from './IngresosView';
import { MetricasView } from './MetricasView';
import { AlertasView } from './AlertasView';
import { Trend } from '../components/ui';

const cita = (over) => ({
  id: 'x', hora: '10:00', fecha: '2026-10-08', cliente: 'Carlos Gómez', telefono: '', servicio: 'Corte clásico', serviceId: 's1',
  barbero: 'Julián Patiño', employeeId: 'e1', estado: 'Pendiente', status: 'pending', metodoPago: null, valor: null, ...over,
});
const citasHoy = [
  cita({ id: '1', hora: '09:00', cliente: 'Ana', estado: 'Finalizada', status: 'completed' }),
  cita({ id: '2', hora: '10:00', cliente: 'Beto', estado: 'Pendiente' }),
  cita({ id: '3', hora: '11:00', cliente: 'Cami', estado: 'Confirmada', status: 'confirmed' }),
  cita({ id: '4', hora: '12:00', cliente: 'Dani', estado: 'Confirmada', status: 'confirmed' }),
  cita({ id: '5', hora: '13:00', cliente: 'Eli', estado: 'Cancelada', status: 'cancelled' }),
];
const panel = {
  date: '2026-10-08', citasHoy: 4, finalizadas: 1, pendientes: 3, ingresosHoy: 90000, ingresosSemana: 400000, ingresosMes: 2300000, ocupacion: 40, clientesNuevosMes: 5,
  rangoSemana: { desde: '2026-10-05', hasta: '2026-10-11' }, semana: [{ dia: 'Lun', fecha: '2026-10-05', ingresos: 100000 }],
  trends: { citas: 10, ingresos: -5, ocupacion: 0, semana: 12, mes: -8, clientesNuevos: 25 },
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listAppointments.mockResolvedValue({ appointments: citasHoy });
  api.dashboardAnalytics.mockResolvedValue(panel);
});

describe('Trend (0 % neutro y lector de pantalla)', () => {
  it('sube, baja y sin cambio; el 0 % no es una subida verde', () => {
    const { container, rerender } = render(<Trend value={12} />);
    expect(container).toHaveTextContent('12% más');
    rerender(<Trend value={-8} />);
    expect(container).toHaveTextContent('8% menos');
    rerender(<Trend value={0} />);
    expect(container).toHaveTextContent('0% sin cambio');
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('panel general', () => {
  const montar = async () => {
    render(<DashboardView servicios={[{ id: 's1', nombre: 'Corte clásico', duracion: 45, veces: 3 }]} citasVersion={0} esOwner />);
    await screen.findByText('Citas programadas hoy');
  };

  it('U18: «por atender» cuenta pendientes Y confirmadas (3), no solo las pendientes', async () => {
    await montar();
    expect(await screen.findByText('1 finalizadas · 3 por atender')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d pendientes/);
  });

  it('el crecimiento aclara contra qué se compara cada variación', async () => {
    await montar();
    expect(await screen.findByText('Hasta hoy, contra los mismos días de la semana anterior')).toBeInTheDocument();
    expect(screen.getByText('Hasta hoy, contra el mismo tramo del mes anterior')).toBeInTheDocument();
    expect(screen.getByText(/Fichas creadas; la variación es contra el mismo tramo/)).toBeInTheDocument();
  });

  it('el 0 % de ocupación se ve neutro («sin cambio»)', async () => {
    await montar();
    expect(await screen.findByText('Tasa de ocupación')).toBeInTheDocument();
    const fila = screen.getByText('Tasa de ocupación').closest('.bd-statline');
    expect(fila).toHaveTextContent('0% sin cambio');
  });

  it('un barbero no pide ni ve las analíticas de dinero', async () => {
    render(<DashboardView servicios={[]} citasVersion={0} esOwner={false} />);
    await screen.findByText('Citas programadas hoy');
    expect(api.dashboardAnalytics).not.toHaveBeenCalled();
    expect(screen.queryByText('Ingresos de hoy')).toBeNull();
  });

  it('si fallan las analíticas lo dice y el resto del panel sigue', async () => {
    api.dashboardAnalytics.mockRejectedValue(new Error('Sin conexión'));
    await montar();
    expect((await screen.findAllByText(/No se pudieron cargar los ingresos: Sin conexión/)).length).toBeGreaterThan(0);
    expect(screen.getByText('Citas programadas hoy')).toBeInTheDocument();
  });
});

describe('ingresos y métricas', () => {
  const ingresos = {
    period: 'week', data: [{ dia: 'Lun', fecha: '2026-10-05', ingresos: 1000 }],
    resumen: { ingresosMes: 2300000, trendMes: -8, serviciosRealizados: 40, ticketPromedio: 38000, servicioTop: { nombre: 'Fade', ingresos: 900000 } },
    paymentMethods: [{ name: 'Efectivo', value: 50, color: '#007A6E' }, { name: 'Tarjeta', value: 50, color: '#4F46E5' }], servicesComparison: [{ name: 'Fade', ingresos: 900000 }],
  };
  const metricas = {
    period: 'week', demandaHora: [{ hora: '9am', citas: 2 }], rentabilidadDia: [{ dia: 'Lun', valor: 1000 }], ocupacion: 40,
    nuevosVsRecurrentes: [{ name: 'Recurrentes', value: 67 }, { name: 'Nuevos', value: 33 }], topServicio: { nombre: 'Fade', veces: 3 }, evolucionMensual: [{ mes: 'Oct', ingresos: 1, clientes: 1 }],
  };

  it('ingresos: la variación del mes explica su base y los métodos de pago se titulan como son (solo servicios)', async () => {
    api.revenueAnalytics.mockResolvedValue(ingresos);
    render(<IngresosView />);
    expect(await screen.findByText(/Variación: hasta hoy vs. mismo tramo del mes anterior/)).toBeInTheDocument();
    expect(screen.getByText('Cómo pagaron los servicios — este mes')).toBeInTheDocument();
    expect(screen.getByText('Finalizados este mes')).toBeInTheDocument();
  });

  it('el selector de período indica cuál está activo y pide el período al servidor', async () => {
    api.revenueAnalytics.mockResolvedValue(ingresos);
    const user = userEvent.setup();
    render(<IngresosView />);
    await screen.findByText('Ingresos del mes');
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true');
    expect(api.revenueAnalytics).toHaveBeenLastCalledWith({ period: 'month' });
  });

  it('métricas: «Ingresos por día de la semana» y «Servicio más realizado» (antes «Días más rentables» y «más vendido»)', async () => {
    api.metricsAnalytics.mockResolvedValue(metricas);
    render(<MetricasView />);
    expect(await screen.findByText('Ingresos por día de la semana')).toBeInTheDocument();
    expect(screen.getByText('Servicio más realizado')).toBeInTheDocument();
    expect(screen.queryByText('Días más rentables')).toBeNull();
  });
});

describe('alertas', () => {
  const alertas = {
    alerts: [
      { id: 'sincerrar', tipo: 'sincerrar', prioridad: 'alta', titulo: 'Citas de días anteriores sin cerrar', detalle: '2 cita(s) siguen pendientes.', items: [{ nombre: 'De Hace Tres', dato: '5 oct 09:00' }], accion: 'Ir a la agenda', destino: 'agenda' },
      { id: 'stock', tipo: 'stock', prioridad: 'alta', titulo: 'Productos con stock bajo', detalle: '2 producto(s)...', items: [{ nombre: 'Pomada', dato: 'Agotado' }, { nombre: 'Cera mate', dato: '2 unidades' }], accion: 'Revisar inventario', destino: 'inventario' },
      { id: 'inactivos', tipo: 'inactivos', prioridad: 'media', titulo: 'Clientes que no regresan', detalle: '1 cliente(s)', items: [{ nombre: 'Iván', dato: 'Última visita: 9 ago 2026' }], accion: 'Ver clientes', destino: 'clientes' },
    ],
  };

  it('muestra cada alerta con su prioridad en frase normal (no en mayúsculas), sus ítems y su acción', async () => {
    api.alertsAnalytics.mockResolvedValue(alertas);
    render(<AlertasView onNavigate={() => {}} />);
    expect(await screen.findByText('Citas de días anteriores sin cerrar')).toBeInTheDocument();
    expect(screen.getAllByText('Prioridad alta')).toHaveLength(2);
    expect(screen.getByText('Prioridad media')).toBeInTheDocument();
    expect(screen.getByText(/Última visita: 9 ago 2026/)).toBeInTheDocument();
    expect(screen.getByText(/2 unidades/)).toBeInTheDocument();
    expect(document.querySelector('.uppercase')).toBeNull();
  });

  it('cada botón lleva a su sección', async () => {
    api.alertsAnalytics.mockResolvedValue(alertas);
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<AlertasView onNavigate={onNavigate} />);
    await screen.findByText('Citas de días anteriores sin cerrar');
    await user.click(screen.getByRole('button', { name: 'Ir a la agenda' }));
    expect(onNavigate).toHaveBeenCalledWith('agenda');
    await user.click(screen.getByRole('button', { name: 'Revisar inventario' }));
    expect(onNavigate).toHaveBeenLastCalledWith('inventario');
  });

  it('sin alertas dice que todo está en orden; si falla la carga lo dice', async () => {
    api.alertsAnalytics.mockResolvedValue({ alerts: [] });
    const { unmount } = render(<AlertasView onNavigate={() => {}} />);
    expect(await screen.findByText('Todo en orden: no hay alertas por ahora.')).toBeInTheDocument();
    unmount();
    api.alertsAnalytics.mockRejectedValue(new Error('Sin conexión'));
    render(<AlertasView onNavigate={() => {}} />);
    expect(await within(document.body).findByText(/Sin conexión/)).toBeInTheDocument();
  });
});
