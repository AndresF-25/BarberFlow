import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Clock, Phone, AlertTriangle, CheckCircle2, UserCheck, Trash2, CreditCard, Wallet, Smartphone, CalendarX,
} from 'lucide-react';
import { api, todayIso } from '../../../api/client';
import { C, ESTADOS, DIAS_SEMANA, fmtCOP } from '../theme';
import { Modal } from '../components/Modal';
import {
  isoToUtc, addDaysIso, startOfWeekIso, startOfMonthIso, endOfMonthIso, addMonthsIso, fmtFechaLarga, capitalizar, fmtRangoSemana,
} from '../dates';
import { useCitas } from '../hooks/useCitas';
import { Badge, SectionCard, EmptyState } from '../components/ui';

const METODOS_PAGO_OPCIONES = [
  { value: 'cash', label: 'Efectivo', icon: Wallet },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: Smartphone },
];
const METODO_LABEL = Object.fromEntries(METODOS_PAGO_OPCIONES.map(m => [m.value, m.label]));

function FinalizarCitaModal({ cita, onClose, onConfirm }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const finalizar = async (paymentMethod) => {
    setGuardando(true);
    setError('');
    const result = await onConfirm(cita.id, { status: 'completed', paymentMethod });
    setGuardando(false);
    if (result?.ok) onClose();
    else setError(result?.error || 'No se pudo finalizar la cita.');
  };

  return (
    <Modal title="Finalizar cita" size="sm" onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: C.textMuted }}>{cita.cliente} · {cita.servicio}. ¿Cómo pagó el cliente?</p>
      <div className="space-y-2">
        {METODOS_PAGO_OPCIONES.map(({ value, label, icon: Icon }) => (
          <button key={value} disabled={guardando} onClick={() => finalizar(value)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" style={{ border: `1px solid ${C.border}`, color: C.text }}>
            <Icon size={15} style={{ color: C.accent }} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs mt-4" style={{ color: C.red }}>{error}</p>}
      <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
    </Modal>
  );
}

function CancelarCitaModal({ cita, onClose, onConfirm }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cancelar = async () => {
    setGuardando(true);
    setError('');
    const result = await onConfirm(cita.id, { status: 'cancelled' });
    setGuardando(false);
    if (result?.ok) onClose();
    else setError(result?.error || 'No se pudo cancelar la cita.');
  };

  return (
    <Modal title="¿Cancelar la cita?" size="sm" onClose={onClose}>
      <p className="text-xs mb-5" style={{ color: C.textMuted }}>
        Vas a cancelar la cita de <strong style={{ color: C.text }}>{cita.cliente}</strong> ({cita.servicio}, {cita.hora}). El horario queda libre y no se puede reabrir.
      </p>
      {error && <p role="alert" className="text-xs mb-4" style={{ color: C.red }}>{error}</p>}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Volver</button>
        <button onClick={cancelar} disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.red, color: '#fff' }}>{guardando ? 'Cancelando…' : 'Cancelar cita'}</button>
      </div>
    </Modal>
  );
}

export function AgendaView({ citasVersion, onChanged }) {
  const [vista, setVista] = useState('Día');
  const [filtro, setFiltro] = useState('Todas');
  const [ancla, setAncla] = useState(todayIso());
  const [finalizando, setFinalizando] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [errorAccion, setErrorAccion] = useState('');

  const hoy = todayIso();
  const semanaInicio = startOfWeekIso(ancla);
  const rango = vista === 'Día' ? [ancla, ancla]
    : vista === 'Semana' ? [semanaInicio, addDaysIso(semanaInicio, 6)]
    : [startOfMonthIso(ancla), endOfMonthIso(ancla)];
  const { citas, loading, error } = useCitas(rango[0], rango[1], citasVersion);

  const filtradas = filtro === 'Todas' ? citas : citas.filter(c => c.estado === filtro);

  const mover = (dir) => setAncla(a => vista === 'Día' ? addDaysIso(a, dir) : vista === 'Semana' ? addDaysIso(a, 7 * dir) : addMonthsIso(a, dir));
  const irADia = (iso) => { setAncla(iso); setVista('Día'); };

  const actualizarCita = async (id, cambios) => {
    try {
      await api.updateAppointment(id, cambios);
      setErrorAccion('');
      onChanged();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  const confirmar = async (cita) => {
    const result = await actualizarCita(cita.id, { status: 'confirmed' });
    if (!result.ok) setErrorAccion(result.error);
  };

  const titulo = vista === 'Día' ? capitalizar(fmtFechaLarga(ancla))
    : vista === 'Semana' ? `Semana del ${fmtRangoSemana(rango[0], rango[1])}`
    : capitalizar(isoToUtc(ancla).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }));

  const estadoLista = loading
    ? <EmptyState icon={Clock} text="Cargando citas…" />
    : error ? <EmptyState icon={AlertTriangle} text={`No se pudieron cargar las citas: ${error}`} /> : null;

  return (
    <div className="space-y-6 bd-fade-in">
      {finalizando && <FinalizarCitaModal cita={finalizando} onClose={() => setFinalizando(null)} onConfirm={actualizarCita} />}
      {cancelando && <CancelarCitaModal cita={cancelando} onClose={() => setCancelando(null)} onConfirm={actualizarCita} />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden" role="group" aria-label="Vista de la agenda" style={{ border: `1px solid ${C.border}` }}>
          {['Día', 'Semana', 'Mes'].map(v => (
            <button key={v} onClick={() => setVista(v)} aria-pressed={vista === v} className="px-4 py-2 text-xs font-medium"
              style={{ background: vista === v ? C.surface : 'transparent', color: vista === v ? C.accent : C.textMuted }}>{v}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => mover(-1)} className="w-8 h-8 rounded-md flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Anterior"><ChevronLeft size={14} style={{ color: C.textMuted }} aria-hidden="true" /></button>
          <button onClick={() => setAncla(hoy)} className="px-3 h-8 rounded-md text-xs font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Hoy</button>
          <button onClick={() => mover(1)} className="w-8 h-8 rounded-md flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Siguiente"><ChevronRight size={14} style={{ color: C.textMuted }} aria-hidden="true" /></button>
        </div>
        <div className="flex items-center gap-1 ml-auto flex-wrap" role="group" aria-label="Filtrar por estado">
          {['Todas', 'Confirmada', 'Pendiente', 'Finalizada', 'Cancelada'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} aria-pressed={filtro === f} className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: filtro === f ? C.accentBg : 'transparent', color: filtro === f ? C.accent : C.textFaint, border: `1px solid ${filtro === f ? C.accent + '55' : C.border}` }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {errorAccion && <p role="alert" className="text-xs p-3 rounded-lg" style={{ background: C.redBg, color: C.red }}>{errorAccion}</p>}

      {vista === 'Semana' ? (
        <SectionCard title={titulo}>
          {estadoLista || (
            <div className="overflow-x-auto bd-scroll">
              <div className="grid gap-2 min-w-[700px]" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {DIAS_SEMANA.map((d, i) => {
                  const iso = addDaysIso(semanaInicio, i);
                  const delDia = filtradas.filter(c => c.fecha === iso);
                  return (
                    <div key={iso} className="rounded-lg p-2" style={{ background: C.bgSoft, border: `1px solid ${iso === hoy ? C.accent + '66' : C.borderSoft}` }}>
                      <button onClick={() => irADia(iso)} aria-label={`Ver el día ${capitalizar(fmtFechaLarga(iso))}`} className="w-full text-xs font-semibold mb-2 text-center" style={{ color: iso === hoy ? C.accent : C.textMuted }}>{d} {Number(iso.slice(8))}</button>
                      <div className="space-y-1.5">
                        {delDia.map(c => (
                          <div key={c.id} className="text-[10px] p-1.5 rounded" style={{ background: C.surface, color: C.textMuted, borderLeft: `2px solid ${ESTADOS[c.estado].color}` }}>
                            <div className="font-medium" style={{ color: C.text }}>{c.hora}</div>
                            <div className="truncate">{c.cliente}</div>
                            <span className="sr-only">{c.estado}</span>
                          </div>
                        ))}
                        {delDia.length === 0 && <div className="text-[10px] text-center" style={{ color: C.textFaint }}>—</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>
      ) : vista === 'Mes' ? (
        <SectionCard title={titulo}>
          {estadoLista || (
            <>
              <div className="grid grid-cols-7 gap-2 text-center mb-2">
                {DIAS_SEMANA.map(d => <div key={d} className="text-xs" style={{ color: C.textFaint }}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: (isoToUtc(rango[0]).getUTCDay() + 6) % 7 }).map((_, i) => <div key={`v${i}`} />)}
                {Array.from({ length: Number(rango[1].slice(8)) }).map((_, i) => {
                  const day = i + 1;
                  const iso = `${rango[0].slice(0, 8)}${String(day).padStart(2, '0')}`;
                  const count = filtradas.filter(c => c.fecha === iso && c.estado !== 'Cancelada').length;
                  const esHoy = iso === hoy;
                  return (
                    <button key={iso} onClick={() => irADia(iso)} aria-label={`${capitalizar(fmtFechaLarga(iso))}: ${count === 0 ? 'sin citas' : `${count} ${count === 1 ? 'cita' : 'citas'}`}`}
                      className="rounded-lg p-2 h-16 flex flex-col justify-between text-left"
                      style={{ background: esHoy ? C.accentBg : C.bgSoft, border: `1px solid ${esHoy ? C.accent + '66' : C.borderSoft}` }}>
                      <span className="text-xs" style={{ color: esHoy ? C.accent : C.textMuted }}>{day}</span>
                      {count > 0 && <span className="text-[10px] self-start px-1.5 rounded-full" style={{ background: C.surface, color: C.textFaint }}>{count} {count === 1 ? 'cita' : 'citas'}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </SectionCard>
      ) : (
        <SectionCard title={`Agenda — ${titulo}`}>
          <div className="space-y-2">
            {estadoLista}
            {!loading && !error && filtradas.map(c => {
              const abierta = c.estado === 'Pendiente' || c.estado === 'Confirmada';
              const sinCerrar = abierta && c.fecha < hoy; // una cita de un día anterior sigue pendiente: falta finalizarla o cancelarla
              return (
                <div key={c.id} className="bd-row flex flex-wrap items-center gap-3 py-3.5 px-2 -mx-2 rounded-lg" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <div className="flex items-center gap-2 w-16">
                    <Clock size={13} style={{ color: C.textFaint }} aria-hidden="true" />
                    <span className="text-xs font-semibold" style={{ color: C.accent }}>{c.hora}</span>
                  </div>
                  <div className="min-w-[140px] flex-1">
                    <div className="text-sm font-medium">{c.cliente}</div>
                    {c.telefono && <div className="text-xs flex items-center gap-1" style={{ color: C.textFaint }}><Phone size={11} aria-hidden="true" />{c.telefono}</div>}
                  </div>
                  <div className="text-xs hidden sm:block" style={{ color: C.textMuted }}>{c.servicio}</div>
                  <div className="text-xs hidden md:block" style={{ color: C.textFaint }}>{c.barbero}</div>
                  <Badge estado={c.estado} />
                  {c.estado === 'Finalizada' && c.valor !== null && (
                    <span className="text-xs hidden sm:inline" style={{ color: C.textMuted }}>{fmtCOP(c.valor)} · {METODO_LABEL[c.metodoPago] || '—'}</span>
                  )}
                  {sinCerrar && <span className="text-xs font-medium" style={{ color: C.amber }}>Sin cerrar</span>}
                  {abierta && (
                    <div className="flex items-center gap-1 ml-auto">
                      {c.estado === 'Pendiente' && (
                        <button onClick={() => confirmar(c)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Confirmar" aria-label={`Confirmar la cita de ${c.cliente}`}><CheckCircle2 size={12} style={{ color: C.green }} aria-hidden="true" /></button>
                      )}
                      <button onClick={() => setFinalizando(c)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Finalizar y cobrar" aria-label={`Finalizar y cobrar la cita de ${c.cliente}`}><UserCheck size={12} style={{ color: C.accent }} aria-hidden="true" /></button>
                      <button onClick={() => setCancelando(c)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Cancelar" aria-label={`Cancelar la cita de ${c.cliente}`}><Trash2 size={12} style={{ color: C.red }} aria-hidden="true" /></button>
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && !error && filtradas.length === 0 && <EmptyState icon={CalendarX} text={filtro === 'Todas' ? 'No hay citas para este día.' : 'No hay citas con este filtro.'} />}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
