import { useState } from 'react';
import {
  Scissors, DollarSign, X, Plus, Clock, AlertTriangle, Pencil, Trash2, Flame, Save,
} from 'lucide-react';
import { C, fmtCOP, fmtCompact, CATEGORIAS_SERVICIO } from '../theme';
import { KpiCard, SectionCard, EmptyState } from '../components/ui';

/* =========================================================================
   VISTA: SERVICIOS
   ========================================================================= */
function ServicioModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { nombre: '', categoria: CATEGORIAS_SERVICIO[0], precio: '', duracion: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const esEdicion = !!initial;

  const puedeGuardar = !guardando && form.nombre.trim().length > 1 && Number(form.precio) > 0 && Number(form.duracion) > 0;

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const result = await onSave({ nombre: form.nombre.trim(), categoria: form.categoria, precio: Number(form.precio), duracion: Number(form.duracion) });
    setGuardando(false);
    if (result?.ok) onClose();
    else setError(result?.error || 'No se pudo guardar el servicio.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 bd-fade-in" style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="bd-display text-base font-semibold">{esEdicion ? 'Editar servicio' : 'Nuevo servicio'}</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Nombre del servicio</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }} placeholder="Ej. Corte Clásico" />
          </div>
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Categoría</label>
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }}>
              {CATEGORIAS_SERVICIO.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Precio (COP)</label>
              <input type="number" min="0" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }} placeholder="35000" />
            </div>
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Duración (min)</label>
              <input type="number" min="0" value={form.duracion} onChange={e => setForm({ ...form, duracion: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }} placeholder="30" />
            </div>
          </div>
        </div>
        {error && <p className="text-xs mt-4" style={{ color: C.red }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
          <button
            disabled={!puedeGuardar}
            onClick={guardar}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ background: puedeGuardar ? C.gold : C.borderSoft, color: puedeGuardar ? '#1A1207' : C.textFaint }}>
            <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ServiciosView({ servicios, estado = { loading: false, error: '' }, onAdd, onEdit, onDelete, readOnly = false }) {
  const [modal, setModal] = useState(null); // null | 'new' | servicio-object
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [errorBorrar, setErrorBorrar] = useState('');

  const eliminar = async () => {
    const result = await onDelete(confirmarBorrar.id);
    if (result?.ok) {
      setConfirmarBorrar(null);
      setErrorBorrar('');
    } else {
      setErrorBorrar(result?.error || 'No se pudo eliminar el servicio.');
    }
  };

  const totalServiceRevenue = servicios.reduce((a, s) => a + s.precio * s.veces, 0) || 1;
  const masSolicitado = servicios.length ? [...servicios].sort((a, b) => b.veces - a.veces)[0] : null;

  return (
    <div className="space-y-5 bd-fade-in">
      {!readOnly && modal && (
        <ServicioModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={(data) => modal === 'new' ? onAdd(data) : onEdit(modal.id, data)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Scissors} label="Servicios activos" value={servicios.length} />
        <KpiCard icon={Flame} label="Más solicitado" value={masSolicitado?.nombre || '—'} sub={masSolicitado ? `${masSolicitado.veces} veces este mes` : ''} />
        <KpiCard icon={DollarSign} label="Ingreso total por servicios" value={fmtCompact(totalServiceRevenue)} />
      </div>
      <SectionCard title="Catálogo de servicios" action={
        !readOnly && (
          <button onClick={() => setModal('new')} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: C.gold, color: '#1A1207' }}>
            <Plus size={14} /> Nuevo servicio
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
                <th className="pb-3 font-medium">Solicitudes</th>
                <th className="pb-3 font-medium">Rentabilidad</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {[...servicios].sort((a, b) => (b.precio * b.veces) - (a.precio * a.veces)).map(s => {
                const ingresos = s.precio * s.veces;
                const share = (ingresos / totalServiceRevenue) * 100;
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
                          <div className="h-full rounded-full" style={{ width: `${share}%`, background: C.gold }} />
                        </div>
                        <span className="text-xs" style={{ color: C.textFaint }}>{share.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {!readOnly && (
                        <>
                          <button onClick={() => setModal(s)} className="w-7 h-7 rounded-md inline-flex items-center justify-center mr-1" style={{ border: `1px solid ${C.border}` }} title="Editar">
                            <Pencil size={12} style={{ color: C.textMuted }} />
                          </button>
                          <button onClick={() => setConfirmarBorrar(s)} className="w-7 h-7 rounded-md inline-flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Eliminar">
                            <Trash2 size={12} style={{ color: C.red }} />
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
                <tr><td colSpan={7}><EmptyState icon={Scissors} text="Todavía no tienes servicios cargados." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {!readOnly && confirmarBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => { setConfirmarBorrar(null); setErrorBorrar(''); }}>
          <div className="w-full max-w-sm rounded-xl p-6 bd-fade-in" style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
            <h3 className="bd-display text-base font-semibold mb-2">¿Eliminar servicio?</h3>
            <p className="text-xs mb-5" style={{ color: C.textMuted }}>Vas a eliminar <strong style={{ color: C.text }}>{confirmarBorrar.nombre}</strong> del catálogo. Las citas ya registradas se conservan.</p>
            {errorBorrar && <p className="text-xs mb-4" style={{ color: C.red }}>{errorBorrar}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setConfirmarBorrar(null); setErrorBorrar(''); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
              <button onClick={eliminar} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.red, color: '#fff' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
