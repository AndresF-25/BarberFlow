import { useEffect, useMemo, useState } from 'react';
import { CalendarX, AlertTriangle } from 'lucide-react';
import { C } from '../theme';
import { EmptyState, PoleLoader } from './ui';

/* =========================================================================
   SILLAS DE HOY
   Una fila por barbero, el tiempo en horizontal. Cada cita es un bloque cuyo
   ancho es la duración real del servicio; la línea coral marca "ahora".
   ========================================================================= */
const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const DURACION_POR_DEFECTO = 45;

const ESTILO_BLOQUE = {
  Finalizada: { background: C.ink, color: '#fff', border: `1.5px solid ${C.ink}` },
  Confirmada: { background: C.accent, color: '#fff', border: `1.5px solid ${C.accent}` },
  Pendiente: { background: '#FCEBB8', color: C.ink, border: `1.5px dashed ${C.amberSolid}` },
};

export function LeyendaSillas() {
  const item = (estilo, texto) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-3.5 h-3.5 rounded-[4px] inline-block" style={estilo} aria-hidden="true" />{texto}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: C.textMuted }}>
      {item(ESTILO_BLOQUE.Finalizada, 'Finalizada')}
      {item(ESTILO_BLOQUE.Confirmada, 'Confirmada')}
      {item(ESTILO_BLOQUE.Pendiente, 'Pendiente')}
      <span className="inline-flex items-center gap-1.5">
        <span className="w-0.5 h-3.5 inline-block" style={{ background: C.red }} aria-hidden="true" />Ahora
      </span>
    </div>
  );
}

export function SillasHoy({ citas, servicios, loading, error }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const { filas, inicio, total, marcas } = useMemo(() => {
    const duraciones = new Map(servicios.map(s => [s.id, s.duracion]));
    const items = citas
      .filter(c => c.estado !== 'Cancelada')
      .map(c => ({ ...c, ini: aMinutos(c.hora), dur: duraciones.get(c.serviceId) || DURACION_POR_DEFECTO }));
    if (items.length === 0) return { filas: [], inicio: 0, total: 0, marcas: [] };

    const primera = Math.min(...items.map(i => i.ini));
    const ultima = Math.max(...items.map(i => i.ini + i.dur));
    const ini = Math.max(0, Math.min(9 * 60, Math.floor(primera / 60) * 60));
    const fin = Math.min(24 * 60, Math.max(20 * 60, Math.ceil(ultima / 60) * 60));
    const porBarbero = new Map();
    items.forEach(i => {
      const k = i.employeeId || i.barbero;
      if (!porBarbero.has(k)) porBarbero.set(k, { nombre: i.barbero, citas: [] });
      porBarbero.get(k).citas.push(i);
    });
    const paso = fin - ini > 12 * 60 ? 120 : 60;
    const horas = [];
    for (let t = ini; t <= fin; t += paso) horas.push(t);
    return { filas: [...porBarbero.values()], inicio: ini, total: fin - ini, marcas: horas };
  }, [citas, servicios]);

  if (loading) return <PoleLoader text="Cargando citas…" />;
  if (error) return <EmptyState icon={AlertTriangle} text={`No se pudieron cargar las citas: ${error}`} />;
  if (filas.length === 0) return <EmptyState icon={CalendarX} text="Hoy no hay citas agendadas. Las sillas están libres." />;

  const pct = (min) => `${((min - inicio) / total) * 100}%`;
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const hayAhora = minAhora >= inicio && minAhora <= inicio + total;
  const hora12 = (t) => {
    const h = Math.floor(t / 60);
    return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;
  };
  const colWidth = '7.5rem';
  const rejilla = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(${100 / (total / 60)}% - 1px), ${C.border} calc(${100 / (total / 60)}% - 1px), ${C.border} ${100 / (total / 60)}%)`,
  };

  return (
    <div className="overflow-x-auto bd-scroll pb-1">
      <div style={{ minWidth: '44rem' }}>
        <div className="flex items-end mb-2">
          <div style={{ width: colWidth }} className="flex-shrink-0" />
          <div className="relative flex-1 h-5">
            {marcas.map((t, i) => (
              <span key={t} className="absolute text-xs bd-num" style={{ left: pct(t), color: C.textFaint, transform: i === marcas.length - 1 ? 'translateX(-100%)' : i === 0 ? 'none' : 'translateX(-50%)' }}>{hora12(t)}</span>
            ))}
          </div>
        </div>

        <div className="relative space-y-2">
          {filas.map(f => (
            <div key={f.nombre} className="flex items-center">
              <div style={{ width: colWidth }} className="flex-shrink-0 pr-3 min-w-0">
                <div className="text-sm font-semibold truncate">{f.nombre}</div>
                <div className="text-xs" style={{ color: C.textFaint }}>{f.citas.length} {f.citas.length === 1 ? 'cita' : 'citas'}</div>
              </div>
              <div className="relative flex-1 h-14 rounded-lg overflow-hidden" style={{ background: C.bgSoft, ...rejilla }}>
                {f.citas.map(c => (
                  <div key={c.id} title={`${c.hora} · ${c.cliente} · ${c.servicio} (${c.dur} min) — ${c.estado}`}
                    className="absolute top-1.5 bottom-1.5 rounded-md px-1.5 py-1 overflow-hidden text-[11px] leading-tight"
                    style={{ left: pct(c.ini), width: `calc(${(c.dur / total) * 100}% - 2px)`, ...ESTILO_BLOQUE[c.estado] }}>
                    <div className="font-semibold bd-num truncate">{c.hora}</div>
                    <div className="truncate opacity-90">{c.cliente.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {hayAhora && (
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: colWidth, right: 0 }} aria-hidden="true">
              <div className="absolute top-0 bottom-0 w-0.5" style={{ left: pct(minAhora), background: C.red }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
