import {
  Bell, CheckCircle2, ArrowUpRight, UserCheck, Sparkles, Gift, CalendarClock, Package, CalendarX,
} from 'lucide-react';
import { api } from '../../../api/client';
import { C } from '../theme';
import { SectionCard, EmptyState, EstadoCarga } from '../components/ui';
import { useApi } from '../hooks/useApi';

/* =========================================================================
   VISTA: ALERTAS
   ========================================================================= */
const ALERTA_ICONOS = { sincerrar: CalendarX, inactivos: UserCheck, stock: Package, recordatorio: CalendarClock, fidelizacion: Gift };

export function AlertasView({ onNavigate }) {
  const prioColor = { alta: C.red, media: C.amber, baja: C.green };
  const { data, loading, error } = useApi(() => api.alertsAnalytics(), []);
  const alertas = data?.alerts || [];

  return (
    <div className="space-y-4 bd-fade-in">
      <SectionCard>
        <div className="flex items-center gap-3">
          <Sparkles size={18} style={{ color: C.accent }} />
          <div>
            <div className="text-sm font-medium">Recomendaciones automáticas</div>
            <div className="text-xs" style={{ color: C.textFaint }}>Generadas a partir de la actividad reciente de tu barbería.</div>
          </div>
        </div>
      </SectionCard>

      <EstadoCarga loading={loading} error={error} what="las alertas" />
      {data && alertas.length === 0 && <SectionCard><EmptyState icon={CheckCircle2} text="Todo en orden: no hay alertas por ahora." /></SectionCard>}

      {alertas.map(a => {
        const Icon = ALERTA_ICONOS[a.tipo] || Bell;
        return (
          <div key={a.id} className="rounded-xl p-5" style={{ background: C.bgSoft }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${prioColor[a.prioridad]}1f` }}>
                <Icon size={18} style={{ color: prioColor[a.prioridad] }} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold">{a.titulo}</h4>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ color: prioColor[a.prioridad], background: `${prioColor[a.prioridad]}1f` }}>
                    Prioridad {a.prioridad}
                  </span>
                </div>
                <p className="text-xs mt-1.5" style={{ color: C.textMuted }}>{a.detalle}</p>
                {a.items.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {a.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}` }}>
                        <span className="font-medium">{it.nombre}</span>
                        <span style={{ color: C.textFaint }}>· {it.dato}</span>
                      </div>
                    ))}
                  </div>
                )}
                {a.destino && (
                  <button onClick={() => onNavigate(a.destino)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg" style={{ background: C.accent, color: C.onAccent }}>
                    <ArrowUpRight size={12} aria-hidden="true" /> {a.accion}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
