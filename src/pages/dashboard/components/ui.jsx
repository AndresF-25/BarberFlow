import {
  Clock, AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { C, ESTADOS } from '../theme';

/* =========================================================================
   PRIMITIVOS
   ========================================================================= */
export function Badge({ estado }) {
  const cfg = ESTADOS[estado];
  const Icon = cfg.icon;
  return (
    <span style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap">
      <Icon size={12} /> {estado}
    </span>
  );
}

export function TagPill({ tag }) {
  const map = {
    VIP: { color: C.gold, bg: 'rgba(199,154,91,0.14)' },
    Frecuente: { color: C.green, bg: C.greenBg },
    Nuevo: { color: C.blue, bg: 'rgba(124,151,172,0.14)' },
    Inactivo: { color: C.red, bg: C.redBg },
  };
  const cfg = map[tag];
  return (
    <span style={{ color: cfg.color, background: cfg.bg }} className="px-2 py-0.5 rounded text-xs font-medium">
      {tag}
    </span>
  );
}

export function Trend({ value }) {
  const up = value >= 0;
  return (
    <span style={{ color: up ? C.green : C.red }} className="inline-flex items-center gap-0.5 text-xs font-semibold">
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value)}%
    </span>
  );
}

export function KpiCard({ icon: Icon, label, value, sub, trend }) {
  return (
    <div className="bd-card bd-fade-in p-5 rounded-xl relative overflow-hidden"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="absolute top-0 right-0 w-10 h-10" style={{
        background: `linear-gradient(135deg, transparent 50%, ${C.gold}22 50%)`,
      }} />
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(199,154,91,0.12)' }}>
          <Icon size={18} style={{ color: C.gold }} />
        </div>
        {trend !== undefined && <Trend value={trend} />}
      </div>
      <div className="bd-display text-2xl font-semibold leading-none mb-1.5">{value}</div>
      <div className="text-xs" style={{ color: C.textMuted }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: C.textFaint }}>{sub}</div>}
    </div>
  );
}

export function SectionCard({ title, action, children, className = '' }) {
  return (
    <div className={`bd-fade-in rounded-xl p-5 ${className}`} style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="bd-display text-sm font-semibold tracking-wide" style={{ color: C.text }}>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center" style={{ color: C.textFaint }}>
      <Icon size={28} className="mb-2" />
      <div className="text-sm">{text}</div>
    </div>
  );
}

/* Mensaje de carga o error; devuelve null cuando ya hay datos que mostrar. */
export function EstadoCarga({ loading, error, what }) {
  if (loading) return <EmptyState icon={Clock} text={`Cargando ${what}…`} />;
  if (error) return <EmptyState icon={AlertTriangle} text={`No se pudieron cargar ${what}: ${error}`} />;
  return null;
}

export const trendProp = (v) => (v === null || v === undefined ? undefined : v);

/* =========================================================================
   VISTA: INGRESOS
   ========================================================================= */
export function SelectorPeriodo({ periodo, setPeriodo }) {
  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
      {['Semana', 'Mes'].map(p => (
        <button key={p} onClick={() => setPeriodo(p)} className="px-3 py-1.5 text-xs font-medium" style={{ background: periodo === p ? C.bgSoft : 'transparent', color: periodo === p ? C.gold : C.textMuted }}>{p}</button>
      ))}
    </div>
  );
}

export function LeyendaPastel({ datos }) {
  return (
    <div className="space-y-2.5">
      {datos.map(m => (
        <div key={m.name} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
          <span style={{ color: C.textMuted }}>{m.name}</span>
          <span className="font-semibold ml-auto">{m.value}%</span>
        </div>
      ))}
    </div>
  );
}
