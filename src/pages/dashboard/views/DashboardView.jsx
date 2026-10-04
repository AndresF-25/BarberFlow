import {
  CalendarDays, Scissors, DollarSign, Clock, AlertTriangle, UserCheck, Activity, CalendarX,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api, todayIso } from '../../../api/client';
import { C, fmtCOP, fmtCompact, darkTooltip } from '../theme';
import { useCitas } from '../hooks/useCitas';
import { useApi } from '../hooks/useApi';
import { Badge, Trend, KpiCard, SectionCard, EmptyState, EstadoCarga, trendProp } from '../components/ui';
import { fmtFechaCorta } from '../dates';

/* =========================================================================
   VISTA: DASHBOARD
   ========================================================================= */
export function DashboardView({ servicios, citasVersion, esOwner }) {
  const hoy = todayIso();
  const { citas: citasDeHoy, loading: cargandoCitas, error: errorCitas } = useCitas(hoy, hoy, citasVersion);
  const analytics = useApi(() => (esOwner ? api.dashboardAnalytics(hoy) : Promise.resolve(null)), [esOwner, hoy, citasVersion]);
  const a = analytics.data;

  const citasHoy = citasDeHoy.filter(c => c.estado !== 'Cancelada').length;
  const finalizadas = citasDeHoy.filter(c => c.estado === 'Finalizada').length;
  const pendientes = citasDeHoy.filter(c => c.estado === 'Pendiente').length;
  const topServicios = [...servicios].sort((x, y) => y.veces - x.veces).slice(0, 5);
  const proximas = citasDeHoy.filter(c => c.estado === 'Confirmada' || c.estado === 'Pendiente').slice(0, 5);
  const tendencia = (v) => (v === null || v === undefined ? null : <Trend value={v} />);

  return (
    <div className="space-y-6 bd-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={CalendarDays} label="Citas programadas hoy" value={citasHoy} sub={`${finalizadas} finalizadas · ${pendientes} pendientes`} trend={trendProp(a?.trends.citas)} />
        <KpiCard icon={UserCheck} label="Clientes atendidos hoy" value={finalizadas} sub="Citas finalizadas hoy" />
        {esOwner && (
          <>
            <KpiCard icon={DollarSign} label="Ingresos de hoy" value={a ? fmtCompact(a.ingresosHoy) : '—'} sub="vs. mismo día semana pasada" trend={trendProp(a?.trends.ingresos)} />
            <KpiCard icon={Activity} label="Tasa de ocupación" value={a ? `${a.ocupacion}%` : '—'} sub="Agenda de hoy" trend={trendProp(a?.trends.ocupacion)} />
          </>
        )}
      </div>
      {esOwner && analytics.error && <p className="text-xs p-3 rounded-lg" style={{ background: C.redBg, color: C.red }}>No se pudieron cargar los ingresos: {analytics.error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {esOwner && (
          <SectionCard title="Ingresos de la semana" className="xl:col-span-2">
            {a ? (
              <>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <div className="bd-display text-2xl font-semibold">{fmtCOP(a.ingresosSemana)}</div>
                    <div className="text-xs mt-1" style={{ color: C.textFaint }}>Semana del {fmtFechaCorta(a.rangoSemana.desde)} al {fmtFechaCorta(a.rangoSemana.hasta)}</div>
                  </div>
                  {tendencia(a.trends.semana)}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={a.semana} margin={{ left: -20, top: 10 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="dia" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={50} />
                    <Tooltip contentStyle={darkTooltip} formatter={(v) => fmtCOP(v)} />
                    <Area type="monotone" dataKey="ingresos" stroke={C.gold} strokeWidth={2} fill="url(#gRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            ) : <EstadoCarga loading={analytics.loading} error={analytics.error} what="los ingresos" />}
          </SectionCard>
        )}

        <SectionCard title="Servicios más solicitados" className={esOwner ? '' : 'xl:col-span-3'}>
          <div className="space-y-3.5">
            {topServicios.map((s, i) => (
              <div key={s.id}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: C.text }} className="font-medium">{i + 1}. {s.nombre}</span>
                  <span style={{ color: C.textFaint }}>{s.veces}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: C.border }}>
                  <div className="h-full rounded-full" style={{ width: `${topServicios[0].veces ? (s.veces / topServicios[0].veces) * 100 : 0}%`, background: C.gold }} />
                </div>
              </div>
            ))}
            {topServicios.length === 0 && <EmptyState icon={Scissors} text="Aún no hay servicios." />}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SectionCard title="Próximas citas" className={esOwner ? 'xl:col-span-2' : 'xl:col-span-3'} action={<span className="text-xs" style={{ color: C.textFaint }}>Hoy</span>}>
          <div className="space-y-2">
            {proximas.map(c => (
              <div key={c.id} className="bd-row flex items-center gap-3 p-2.5 rounded-lg" style={{ border: `1px solid ${C.borderSoft}` }}>
                <div className="text-xs font-semibold w-12" style={{ color: C.gold }}>{c.hora}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.cliente}</div>
                  <div className="text-xs truncate" style={{ color: C.textFaint }}>{c.servicio} · {c.barbero}</div>
                </div>
                <Badge estado={c.estado} />
              </div>
            ))}
            {cargandoCitas && <EmptyState icon={Clock} text="Cargando citas…" />}
            {!cargandoCitas && errorCitas && <EmptyState icon={AlertTriangle} text={`No se pudieron cargar las citas: ${errorCitas}`} />}
            {!cargandoCitas && !errorCitas && proximas.length === 0 && <EmptyState icon={CalendarX} text="No hay citas pendientes para hoy." />}
          </div>
        </SectionCard>

        {esOwner && (
          <SectionCard title="Crecimiento del negocio">
            {a ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs" style={{ color: C.textMuted }}>Semana vs. anterior</div>
                    <div className="bd-display text-lg font-semibold">{fmtCompact(a.ingresosSemana)}</div>
                  </div>
                  {tendencia(a.trends.semana)}
                </div>
                <div className="h-px" style={{ background: C.border }} />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs" style={{ color: C.textMuted }}>Mes vs. anterior</div>
                    <div className="bd-display text-lg font-semibold">{fmtCompact(a.ingresosMes)}</div>
                  </div>
                  {tendencia(a.trends.mes)}
                </div>
                <div className="h-px" style={{ background: C.border }} />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs" style={{ color: C.textMuted }}>Clientes nuevos este mes</div>
                    <div className="bd-display text-lg font-semibold">{a.clientesNuevosMes}</div>
                  </div>
                  {tendencia(a.trends.clientesNuevos)}
                </div>
              </div>
            ) : <EstadoCarga loading={analytics.loading} error={analytics.error} what="el crecimiento" />}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
