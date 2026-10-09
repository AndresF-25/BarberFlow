import { useState } from 'react';
import {
  Users, DollarSign, Award, CalendarX,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, RadialBarChart, RadialBar,
} from 'recharts';
import { api } from '../../../api/client';
import { C, fmtCOP, fmtCompact, tooltipStyle } from '../theme';
import { SectionCard, EmptyState, EstadoCarga, SelectorPeriodo, LeyendaPastel } from '../components/ui';
import { useApi } from '../hooks/useApi';

/* =========================================================================
   VISTA: MÉTRICAS
   ========================================================================= */
export function MetricasView() {
  const [periodo, setPeriodo] = useState('Semana');
  const { data, loading, error } = useApi(() => api.metricsAnalytics({ period: periodo === 'Mes' ? 'month' : 'week' }), [periodo]);
  const estado = <EstadoCarga loading={loading} error={error} what="las métricas" />;
  const cuando = periodo === 'Mes' ? 'este mes' : 'esta semana';

  if (!data) {
    return <div className="space-y-5 bd-fade-in"><SectionCard>{estado}</SectionCard></div>;
  }

  const colores = { Recurrentes: C.accent, Nuevos: C.blue };
  const nuevosVsRecurrentes = data.nuevosVsRecurrentes.map(m => ({ ...m, color: colores[m.name] }));
  const maxDemanda = Math.max(0, ...data.demandaHora.map(d => d.citas));
  const maxDia = Math.max(0, ...data.rentabilidadDia.map(d => d.valor));
  const radialData = [{ name: 'Ocupación', value: data.ocupacion, fill: C.accent }];

  return (
    <div className="space-y-5 bd-fade-in">
      <div className="flex justify-end"><SelectorPeriodo periodo={periodo} setPeriodo={setPeriodo} /></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Clientes nuevos vs. recurrentes">
          {nuevosVsRecurrentes.length ? (
            <div className="flex items-center gap-6">
              <PieChart width={130} height={130}>
                <Pie data={nuevosVsRecurrentes} dataKey="value" innerRadius={38} outerRadius={62} paddingAngle={3}>
                  {nuevosVsRecurrentes.map((m, i) => <Cell key={i} fill={m.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => v + '%'} />
              </PieChart>
              <LeyendaPastel datos={nuevosVsRecurrentes} />
            </div>
          ) : <EmptyState icon={Users} text={`Sin clientes atendidos ${cuando}.`} />}
        </SectionCard>

        <SectionCard title="Tasa de ocupación de la agenda">
          <ResponsiveContainer width="100%" height={150}>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={20} background={{ fill: C.bgSoft }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-center -mt-24 mb-16">
            <div className="bd-display text-2xl font-semibold">{data.ocupacion}%</div>
            <div className="text-[10px]" style={{ color: C.textFaint }}>{periodo === 'Mes' ? 'Este mes' : 'Esta semana'}</div>
          </div>
          <div className="text-[10px] text-center" style={{ color: C.textFaint }}>Citas agendadas sobre jornada de 10 h por barbero, en los días con actividad.</div>
        </SectionCard>

        <SectionCard title="Servicio más realizado">
          <div className="flex flex-col items-center justify-center h-full py-4 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: C.accentBg }}>
              <Award size={24} style={{ color: C.accent }} />
            </div>
            <div className="bd-display text-base font-semibold">{data.topServicio?.nombre || '—'}</div>
            <div className="text-xs mt-1" style={{ color: C.textFaint }}>
              {data.topServicio ? `${data.topServicio.veces} ${data.topServicio.veces === 1 ? 'servicio' : 'servicios'} ${cuando}` : `Sin servicios finalizados ${cuando}`}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Horarios con mayor demanda">
          {data.demandaHora.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.demandaHora} margin={{ left: 0, top: 10 }}>
                <CartesianGrid stroke={C.borderSoft} vertical={false} />
                <XAxis dataKey="hora" stroke={C.textFaint} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="citas" radius={[4, 4, 0, 0]}>
                  {data.demandaHora.map((d, i) => <Cell key={i} fill={d.citas === maxDemanda ? C.accent : C.accentDim} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={CalendarX} text={`Sin citas ${cuando}.`} />}
        </SectionCard>

        <SectionCard title="Ingresos por día de la semana">
          {maxDia > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.rentabilidadDia} margin={{ left: 0, top: 10 }}>
                <CartesianGrid stroke={C.borderSoft} vertical={false} />
                <XAxis dataKey="dia" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={45} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCOP(v)} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {data.rentabilidadDia.map((d, i) => <Cell key={i} fill={d.valor === maxDia ? C.accent : C.accentDim} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={DollarSign} text={`Sin ingresos ${cuando}.`} />}
        </SectionCard>
      </div>

      <SectionCard title="Evolución mensual del negocio">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.evolucionMensual} margin={{ left: 0, top: 10 }}>
            <CartesianGrid stroke={C.borderSoft} vertical={false} />
            <XAxis dataKey="mes" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={50} />
            <YAxis yAxisId="right" orientation="right" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} width={35} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => n === 'Ingresos' ? fmtCOP(v) : v} />
            <Line yAxisId="left" type="monotone" dataKey="ingresos" stroke={C.accent} strokeWidth={2.5} dot={{ fill: C.accent, r: 3 }} name="Ingresos" />
            <Line yAxisId="right" type="monotone" dataKey="clientes" stroke={C.blue} strokeWidth={2} dot={{ fill: C.blue, r: 3 }} name="Clientes" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-5 mt-2 justify-center text-xs">
          <span className="flex items-center gap-1.5" style={{ color: C.textMuted }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: C.accent }} />Ingresos</span>
          <span className="flex items-center gap-1.5" style={{ color: C.textMuted }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: C.blue }} />Clientes atendidos</span>
        </div>
      </SectionCard>
    </div>
  );
}
