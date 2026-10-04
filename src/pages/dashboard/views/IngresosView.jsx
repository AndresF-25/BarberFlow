import { useState } from 'react';
import {
  Scissors, DollarSign, TrendingUp, Award, CreditCard,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api } from '../../../api/client';
import { C, fmtCOP, fmtCompact, darkTooltip } from '../theme';
import { KpiCard, SectionCard, EmptyState, EstadoCarga, trendProp, SelectorPeriodo, LeyendaPastel } from '../components/ui';
import { useApi } from '../hooks/useApi';

export function IngresosView() {
  const [periodo, setPeriodo] = useState('Semana');
  const { data, loading, error } = useApi(() => api.revenueAnalytics({ period: periodo === 'Mes' ? 'month' : 'week' }), [periodo]);
  const estado = <EstadoCarga loading={loading} error={error} what="los ingresos" />;
  const r = data?.resumen;
  const serie = (data?.data || []).map(d => ({ x: d.dia || d.mes, y: d.ingresos }));
  const recortar = (txt) => (txt.length > 12 ? `${txt.slice(0, 11)}…` : txt);

  return (
    <div className="space-y-5 bd-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Ingresos del mes" value={r ? fmtCompact(r.ingresosMes) : '—'} trend={trendProp(r?.trendMes)} />
        <KpiCard icon={Scissors} label="Servicios realizados" value={r ? r.serviciosRealizados : '—'} sub="Este mes" />
        <KpiCard icon={Award} label="Ticket promedio" value={r ? fmtCOP(r.ticketPromedio) : '—'} sub="Por servicio" />
        <KpiCard icon={TrendingUp} label="Servicio top en ingresos" value={r?.servicioTop?.nombre || '—'} sub={r?.servicioTop ? fmtCompact(r.servicioTop.ingresos) : ''} />
      </div>

      <SectionCard title={`Tendencia de ingresos — ${periodo}`} action={<SelectorPeriodo periodo={periodo} setPeriodo={setPeriodo} />}>
        {data ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={serie} margin={{ left: -20, top: 10 }}>
              <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="x" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={50} />
              <Tooltip contentStyle={darkTooltip} formatter={(v) => fmtCOP(v)} />
              <Line type="monotone" dataKey="y" stroke={C.gold} strokeWidth={2.5} dot={{ fill: C.gold, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : estado}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Ingresos por servicio — este mes">
          {data ? (data.servicesComparison.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.servicesComparison} margin={{ left: -20, top: 10 }}>
                <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={C.textFaint} fontSize={10} tickLine={false} axisLine={false} tickFormatter={recortar} />
                <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={50} />
                <Tooltip contentStyle={darkTooltip} formatter={(v) => fmtCOP(v)} />
                <Bar dataKey="ingresos" fill={C.gold} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={Scissors} text="Aún no hay servicios finalizados este mes." />) : estado}
        </SectionCard>

        <SectionCard title="Métodos de pago utilizados — este mes">
          {data ? (data.paymentMethods.length ? (
            <div className="flex items-center gap-6">
              <PieChart width={140} height={140}>
                <Pie data={data.paymentMethods} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={3}>
                  {data.paymentMethods.map((m, i) => <Cell key={i} fill={m.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={darkTooltip} formatter={(v) => v + '%'} />
              </PieChart>
              <LeyendaPastel datos={data.paymentMethods} />
            </div>
          ) : <EmptyState icon={CreditCard} text="Aún no hay pagos registrados este mes." />) : estado}
        </SectionCard>
      </div>
    </div>
  );
}
