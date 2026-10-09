import {
  Scissors, Clock, AlertTriangle, CalendarX,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api, todayIso } from '../../../api/client';
import { C, fmtCOP, fmtCompact, tooltipStyle } from '../theme';
import { useCitas } from '../hooks/useCitas';
import { useApi } from '../hooks/useApi';
import { Badge, Trend, StatLine, SectionCard, EmptyState, EstadoCarga, trendProp } from '../components/ui';
import { SillasHoy, LeyendaSillas } from '../components/Sillas';
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
  // «Por atender» = pendientes + confirmadas (antes solo contaba las pendientes y no cuadraba con el resto).
  const porAtender = citasDeHoy.filter(c => c.estado === 'Pendiente' || c.estado === 'Confirmada').length;
  const topServicios = [...servicios].sort((x, y) => y.veces - x.veces).slice(0, 5);
  const proximas = citasDeHoy.filter(c => c.estado === 'Confirmada' || c.estado === 'Pendiente').slice(0, 5);
  const tendencia = (v) => (v === null || v === undefined ? null : <Trend value={v} />);

  return (
    <div className="space-y-10 bd-fade-in">
      <SectionCard title="Sillas de hoy" action={<LeyendaSillas />}>
        <SillasHoy citas={citasDeHoy} servicios={servicios} loading={cargandoCitas} error={errorCitas} />
      </SectionCard>

      <SectionCard title="Resumen de hoy">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-12">
          <StatLine label="Citas programadas hoy" value={citasHoy} sub={`${finalizadas} finalizadas · ${porAtender} por atender`} trend={trendProp(a?.trends.citas)} />
          <StatLine label="Clientes atendidos hoy" value={finalizadas} sub="Citas finalizadas hoy" />
          {esOwner && (
            <>
              <StatLine label="Ingresos de hoy" value={a ? fmtCompact(a.ingresosHoy) : '—'} sub="vs. mismo día semana pasada" trend={trendProp(a?.trends.ingresos)} />
              <StatLine label="Tasa de ocupación" value={a ? `${a.ocupacion}%` : '—'} sub="Agenda de hoy" trend={trendProp(a?.trends.ocupacion)} />
            </>
          )}
        </div>
      </SectionCard>
      {esOwner && analytics.error && <p className="text-sm p-3 rounded-lg" style={{ background: C.redBg, color: C.red }}>No se pudieron cargar los ingresos: {analytics.error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-x-12 gap-y-10">
        {esOwner && (
          <SectionCard title="Ingresos de la semana" className="xl:col-span-2">
            {a ? (
              <>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <div className="bd-display bd-num text-4xl">{fmtCOP(a.ingresosSemana)}</div>
                    <div className="text-sm mt-1" style={{ color: C.textFaint }}>Semana del {fmtFechaCorta(a.rangoSemana.desde)} al {fmtFechaCorta(a.rangoSemana.hasta)}</div>
                  </div>
                  {tendencia(a.trends.semana)}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={a.semana} margin={{ left: 0, top: 10 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.accent} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.borderSoft} vertical={false} />
                    <XAxis dataKey="dia" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={50} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCOP(v)} />
                    <Area type="monotone" dataKey="ingresos" stroke={C.accent} strokeWidth={2.5} fill="url(#gRev)" />
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
                <div className="flex justify-between text-sm mb-1.5">
                  <span style={{ color: C.text }} className="font-medium">{i + 1}. {s.nombre}</span>
                  <span style={{ color: C.textFaint }}>{s.veces}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: C.bgSoft }}>
                  <div className="h-full rounded-full" style={{ width: `${topServicios[0].veces ? (s.veces / topServicios[0].veces) * 100 : 0}%`, background: C.accent }} />
                </div>
              </div>
            ))}
            {topServicios.length === 0 && <EmptyState icon={Scissors} text="Aún no hay servicios." />}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-x-12 gap-y-10">
        <SectionCard title="Próximas citas" className={esOwner ? 'xl:col-span-2' : 'xl:col-span-3'} action={<span className="text-xs" style={{ color: C.textFaint }}>Hoy</span>}>
          <div>
            {proximas.map(c => (
              <div key={c.id} className="bd-row flex items-center gap-4 py-3 px-2 -mx-2 rounded-lg" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                <div className="bd-display bd-num text-lg w-14 flex-shrink-0">{c.hora}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{c.cliente}</div>
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
              <div className="bd-stack">
                <StatLine label="Semana vs. anterior" value={fmtCompact(a.ingresosSemana)} sub="Hasta hoy, contra los mismos días de la semana anterior" trend={trendProp(a.trends.semana)} />
                <StatLine label="Mes vs. anterior" value={fmtCompact(a.ingresosMes)} sub="Hasta hoy, contra el mismo tramo del mes anterior" trend={trendProp(a.trends.mes)} />
                <StatLine label="Clientes nuevos este mes" value={a.clientesNuevosMes} sub="Fichas creadas; la variación es contra el mismo tramo del mes anterior" trend={trendProp(a.trends.clientesNuevos)} />
              </div>
            ) : <EstadoCarga loading={analytics.loading} error={analytics.error} what="el crecimiento" />}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
