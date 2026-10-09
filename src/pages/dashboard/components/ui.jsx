import {
  AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { C, INV, ESTADOS } from '../theme';

/* =========================================================================
   PRIMITIVOS
   ========================================================================= */
export function Badge({ estado }) {
  const cfg = ESTADOS[estado];
  const Icon = cfg.icon;
  return (
    <span style={{ color: cfg.color, background: cfg.bg }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
      <Icon size={12} aria-hidden="true" /> {estado}
    </span>
  );
}

export function TagPill({ tag }) {
  const map = {
    VIP: { color: C.accent, bg: C.accentBg },
    Frecuente: { color: C.green, bg: C.greenBg },
    Nuevo: { color: C.blue, bg: C.blueBg },
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
  // 0 % es «igual», no una subida: sin flecha ni color de alerta/éxito. Los lectores de pantalla oyen «sube/baja».
  if (value === 0) {
    return <span style={{ color: C.textFaint }} className="inline-flex items-center gap-0.5 text-xs font-semibold">0%<span className="sr-only"> sin cambio</span></span>;
  }
  const up = value > 0;
  return (
    <span style={{ color: up ? C.green : C.red }} className="inline-flex items-center gap-0.5 text-xs font-semibold">
      {up ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}
      {Math.abs(value)}%
      <span className="sr-only">{up ? ' más' : ' menos'}</span>
    </span>
  );
}

/* Cifra en bloque tonal (sin borde ni sombra): etiqueta, número grande y detalle. */
export function KpiCard({ icon: Icon, label, value, sub, trend, tienda = false, alerta = false }) {
  const tono = alerta ? C.red : tienda ? INV.accent : C.accent;
  return (
    <div className="bd-fade-in p-5 rounded-xl" style={{ background: tienda ? INV.surface : C.bgSoft }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-medium min-w-0" style={{ color: C.textMuted }}>
          {Icon && <Icon size={15} style={{ color: tono }} aria-hidden="true" className="flex-shrink-0" />}
          <span className="truncate">{label}</span>
        </div>
        {trend !== undefined && <Trend value={trend} />}
      </div>
      <div className="bd-display bd-num text-4xl leading-none">{value}</div>
      {sub && <div className="text-xs mt-2" style={{ color: C.textFaint }}>{sub}</div>}
    </div>
  );
}

/* Cifra en línea: etiqueta a la izquierda, número a la derecha, separadas por líneas finas. */
export function StatLine({ label, value, sub, trend }) {
  return (
    <div className="bd-statline flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>{sub}</div>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {trend !== undefined && <Trend value={trend} />}
        <div className="bd-display bd-num text-3xl leading-none">{value}</div>
      </div>
    </div>
  );
}

/* Sección sin caja: un título y su contenido, separados del bloque anterior por aire y una línea fina. */
export function SectionCard({ title, action, children, className = '' }) {
  return (
    <section className={`bd-fade-in pt-5 ${className}`} style={{ borderTop: `1px solid ${C.border}` }}>
      {title && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="bd-display text-xl leading-tight" style={{ color: C.text }}>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
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
export function PoleLoader({ text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center" style={{ color: C.textFaint }} role="status">
      <div className="bd-loadbar" aria-hidden="true" />
      <div className="text-sm">{text}</div>
    </div>
  );
}

export function EstadoCarga({ loading, error, what }) {
  if (loading) return <PoleLoader text={`Cargando ${what}…`} />;
  if (error) return <EmptyState icon={AlertTriangle} text={`No se pudieron cargar ${what}: ${error}`} />;
  return null;
}

export const trendProp = (v) => (v === null || v === undefined ? undefined : v);

/* =========================================================================
   VISTA: INGRESOS
   ========================================================================= */
export function SelectorPeriodo({ periodo, setPeriodo }) {
  return (
    <div className="inline-flex p-0.5 rounded-lg" role="group" aria-label="Período" style={{ background: C.bgSoft }}>
      {['Semana', 'Mes'].map(p => (
        <button key={p} onClick={() => setPeriodo(p)} aria-pressed={periodo === p} className="px-3.5 py-1.5 text-xs font-semibold rounded-md"
          style={{ background: periodo === p ? C.ink : 'transparent', color: periodo === p ? '#fff' : C.textMuted }}>{p}</button>
      ))}
    </div>
  );
}

export function LeyendaPastel({ datos }) {
  return (
    <div className="space-y-2.5">
      {datos.map(m => (
        <div key={m.name} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} aria-hidden="true" />
          <span style={{ color: C.textMuted }}>{m.name}</span>
          <span className="font-semibold ml-auto">{m.value}%</span>
        </div>
      ))}
    </div>
  );
}
