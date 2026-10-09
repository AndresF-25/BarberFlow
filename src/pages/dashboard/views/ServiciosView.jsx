import { useState } from 'react';
import {
  Scissors, DollarSign, Plus, Clock, AlertTriangle, Pencil, Trash2, Flame, Save, Info,
} from 'lucide-react';
import { C, fmtCOP, fmtCompact, CATEGORIAS_SERVICIO } from '../theme';
import { Modal, Field } from '../components/Modal';
import { KpiCard, SectionCard, EmptyState } from '../components/ui';

/* =========================================================================
   VISTA: SERVICIOS
   Las reglas de validación replican las del servidor (routes/services.js); el servidor es quien decide.
   ========================================================================= */
const MAX_PRECIO = 10000000;
const MAX_DURACION = 600;
const inputStyle = { background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text };
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none';

function validar(form) {
  const nombre = form.nombre.trim();
  const precio = Number(form.precio);
  const duracion = Number(form.duracion);
  if (!nombre) return 'Ingresa el nombre del servicio.';
  if (nombre.length > 80) return 'El nombre del servicio es demasiado largo (máximo 80 caracteres).';
  if (form.precio === '' || !Number.isInteger(precio) || precio < 0) return 'El precio debe ser un número entero de pesos.';
  if (precio > MAX_PRECIO) return 'El precio es demasiado alto (máximo $10.000.000).';
  if (form.duracion === '' || !Number.isInteger(duracion) || duracion < 1) return 'La duración debe ser un número entero de minutos, mayor que cero.';
  if (duracion > MAX_DURACION) return 'La duración es demasiado larga (máximo 600 minutos).';
  return '';
}

function ServicioModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial
    ? { nombre: initial.nombre, categoria: initial.categoria, precio: String(initial.precio), duracion: String(initial.duracion) }
    : { nombre: '', categoria: CATEGORIAS_SERVICIO[0], precio: '', duracion: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const esEdicion = !!initial;
  // Un servicio con una categoría que ya no está en la lista conserva la suya en vez de saltar a «Cortes».
  const categorias = CATEGORIAS_SERVICIO.includes(form.categoria) ? CATEGORIAS_SERVICIO : [...CATEGORIAS_SERVICIO, form.categoria];

  const guardar = async (e) => {
    e.preventDefault();
    const problema = validar(form);
    if (problema) return setError(problema);
    setGuardando(true);
    setError('');
    const result = await onSave({ nombre: form.nombre.trim(), categoria: form.categoria, precio: Number(form.precio), duracion: Number(form.duracion) });
    setGuardando(false);
    if (result?.ok) onClose(result);
    else setError(result?.error || 'No se pudo guardar el servicio.');
  };

  return (
    <Modal title={esEdicion ? 'Editar servicio' : 'Nuevo servicio'} onClose={() => onClose()} showClose>
      <form onSubmit={guardar} noValidate>
        <div className="space-y-3">
          <Field label="Nombre del servicio">
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={inputClass} style={inputStyle} placeholder="Ej. Corte Clásico" autoComplete="off" />
          </Field>
          <Field label="Categoría">
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className={inputClass} style={inputStyle}>
              {categorias.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio (COP)">
              <input type="number" inputMode="numeric" min="0" max={MAX_PRECIO} step="1" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} className={inputClass} style={inputStyle} placeholder="35000" />
            </Field>
            <Field label="Duración (min)">
              <input type="number" inputMode="numeric" min="1" max={MAX_DURACION} step="1" value={form.duracion} onChange={e => setForm({ ...form, duracion: e.target.value })} className={inputClass} style={inputStyle} placeholder="30" />
            </Field>
          </div>
        </div>
        {error && <p role="alert" className="text-xs mt-4" style={{ color: C.red }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={() => onClose()} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
          <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5" style={{ background: C.accent, color: C.onAccent }}>
            <Save size={14} aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function ServiciosView({ servicios, estado = { loading: false, error: '' }, onAdd, onEdit, onDelete, readOnly = false }) {
  const [modal, setModal] = useState(null); // null | 'new' | servicio-object
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [errorBorrar, setErrorBorrar] = useState('');
  const [aviso, setAviso] = useState('');

  const eliminar = async () => {
    const borrado = confirmarBorrar;
    const result = await onDelete(borrado.id);
    if (result?.ok) {
      setConfirmarBorrar(null);
      setErrorBorrar('');
      const n = result.pendingAppointments || 0;
      setAviso(n > 0
        ? `«${borrado.nombre}» salió del catálogo. Le quedan ${plural(n, 'cita pendiente', 'citas pendientes')}: revísalas en la agenda; las ya registradas se conservan.`
        : `«${borrado.nombre}» salió del catálogo. Su historial se conserva.`);
    } else {
      setErrorBorrar(result?.error || 'No se pudo eliminar el servicio.');
    }
  };

  const despuesDeGuardar = (result) => {
    setModal(null);
    const n = result?.scheduleConflicts || 0;
    if (n > 0) setAviso(`La nueva duración hace que ${plural(n, 'cita futura se cruce', 'citas futuras se crucen')} con otra del mismo barbero. Revísalas en la agenda.`);
  };

  const ingresoDe = (s) => s.precio * s.veces;
  const totalServiceRevenue = servicios.reduce((a, s) => a + ingresoDe(s), 0);
  const masSolicitado = servicios.length ? [...servicios].sort((a, b) => b.veces - a.veces)[0] : null;
  const hayRealizados = !!masSolicitado && masSolicitado.veces > 0;

  return (
    <div className="space-y-5 bd-fade-in">
      {!readOnly && modal && (
        <ServicioModal
          initial={modal === 'new' ? null : modal}
          onClose={(result) => (result?.ok ? despuesDeGuardar(result) : setModal(null))}
          onSave={(data) => modal === 'new' ? onAdd(data) : onEdit(modal.id, data)}
        />
      )}

      {aviso && (
        <div role="status" className="flex items-start gap-2.5 text-sm p-3.5 rounded-lg" style={{ background: C.accentBg, color: C.text }}>
          <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: C.accent }} aria-hidden="true" />
          <span className="flex-1">{aviso}</span>
          <button onClick={() => setAviso('')} className="text-xs font-medium" style={{ color: C.textMuted }}>Entendido</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Scissors} label="Servicios activos" value={servicios.length} />
        <KpiCard icon={Flame} label="Más realizado" value={hayRealizados ? masSolicitado.nombre : '—'}
          sub={hayRealizados ? `${plural(masSolicitado.veces, 'vez', 'veces')} en total` : 'Aún no hay servicios finalizados'} />
        <KpiCard icon={DollarSign} label="Ingreso estimado por servicios" value={fmtCompact(totalServiceRevenue)} sub="Servicios realizados × precio actual" />
      </div>
      <SectionCard title="Catálogo de servicios" action={
        !readOnly && (
          <button onClick={() => setModal('new')} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: C.accent, color: C.onAccent }}>
            <Plus size={14} aria-hidden="true" /> Nuevo servicio
          </button>
        )
      }>
        <div className="overflow-x-auto bd-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: C.textFaint }}>
                <th className="pb-3 font-medium">Servicio</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Categoría</th>
                <th className="pb-3 font-medium">Precio</th>
                <th className="pb-3 font-medium hidden md:table-cell">Duración</th>
                <th className="pb-3 font-medium">Realizados</th>
                <th className="pb-3 font-medium">Peso en ingresos</th>
                <th className="pb-3 font-medium"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {[...servicios].sort((a, b) => ingresoDe(b) - ingresoDe(a)).map(s => {
                const share = totalServiceRevenue > 0 ? (ingresoDe(s) / totalServiceRevenue) * 100 : 0;
                return (
                  <tr key={s.id} className="bd-row" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                    <td className="py-3 font-medium">{s.nombre}</td>
                    <td className="py-3 hidden sm:table-cell" style={{ color: C.textMuted }}>{s.categoria}</td>
                    <td className="py-3" style={{ color: C.textMuted }}>{fmtCOP(s.precio)}</td>
                    <td className="py-3 hidden md:table-cell" style={{ color: C.textMuted }}>{s.duracion} min</td>
                    <td className="py-3" style={{ color: C.textMuted }}>{s.veces}</td>
                    <td className="py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full flex-1" style={{ background: C.border }}>
                          <div className="h-full rounded-full" style={{ width: `${share}%`, background: C.accent }} />
                        </div>
                        <span className="text-xs" style={{ color: C.textFaint }}>{share.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {!readOnly && (
                        <>
                          <button onClick={() => setModal(s)} className="w-7 h-7 rounded-md inline-flex items-center justify-center mr-1" style={{ border: `1px solid ${C.border}` }} title="Editar" aria-label={`Editar ${s.nombre}`}>
                            <Pencil size={12} style={{ color: C.textMuted }} aria-hidden="true" />
                          </button>
                          <button onClick={() => { setErrorBorrar(''); setConfirmarBorrar(s); }} className="w-7 h-7 rounded-md inline-flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Eliminar" aria-label={`Eliminar ${s.nombre}`}>
                            <Trash2 size={12} style={{ color: C.red }} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {estado.loading && (
                <tr><td colSpan={7}><EmptyState icon={Clock} text="Cargando servicios…" /></td></tr>
              )}
              {!estado.loading && estado.error && (
                <tr><td colSpan={7}><EmptyState icon={AlertTriangle} text={`No se pudieron cargar los servicios: ${estado.error}`} /></td></tr>
              )}
              {!estado.loading && !estado.error && servicios.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon={Scissors} text={readOnly ? 'El catálogo todavía está vacío.' : 'Todavía no tienes servicios. Crea el primero con «Nuevo servicio».'} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {!readOnly && confirmarBorrar && (
        <Modal title="¿Eliminar servicio?" size="sm" onClose={() => { setConfirmarBorrar(null); setErrorBorrar(''); }}>
          <p className="text-xs mb-5" style={{ color: C.textMuted }}>Vas a eliminar <strong style={{ color: C.text }}>{confirmarBorrar.nombre}</strong> del catálogo. Las citas ya registradas se conservan.</p>
          {errorBorrar && <p role="alert" className="text-xs mb-4" style={{ color: C.red }}>{errorBorrar}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setConfirmarBorrar(null); setErrorBorrar(''); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
            <button onClick={eliminar} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.red, color: '#fff' }}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
