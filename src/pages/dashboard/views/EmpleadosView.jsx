import { useState } from 'react';
import {
  Users, UserPlus, Pencil, UserX, UserCheck, Info,
} from 'lucide-react';
import { C } from '../theme';
import { SectionCard, EmptyState } from '../components/ui';
import { Modal, Field } from '../components/Modal';

/* =========================================================================
   VISTA: EMPLEADOS (solo owner)
   Equipo del negocio: alta, edición (nombre, especialidad, contraseña), baja y reactivación.
   Los empleados nunca eligen su propio rol ni negocio: el servidor los ata al del dueño.
   ========================================================================= */
const inputStyle = { background: C.bg, border: `1px solid ${C.border}`, color: C.text };
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none';
const REGLA_CLAVE = 'La contraseña debe tener al menos 8 caracteres, con letras y números.';
const claveValida = (v) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);

function NuevoEmpleadoModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', specialty: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Ingresa el nombre del empleado.');
    if (form.specialty.trim().length > 60) return setError('La especialidad es demasiado larga (máximo 60 caracteres).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Ingresa un correo válido.');
    if (!claveValida(form.password)) return setError(REGLA_CLAVE);
    setGuardando(true);
    const result = await onSave(form);
    setGuardando(false);
    if (!result.ok) { setError(result.error); return; }
    onClose();
  };

  return (
    <Modal title="Nuevo empleado" size="sm" onClose={onClose}>
      {error && <div role="alert" className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: C.redBg, color: C.red }}>{error}</div>}
      <form onSubmit={submit} noValidate className="space-y-3">
        <Field label="Nombre">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} autoComplete="off" />
        </Field>
        <Field label="Especialidad (opcional)">
          <input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} className={inputClass} style={inputStyle} placeholder="Ej. Fade y barba" autoComplete="off" />
        </Field>
        <Field label="Correo">
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} style={inputStyle} autoComplete="off" />
        </Field>
        <Field label="Contraseña temporal">
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputClass} style={inputStyle} autoComplete="new-password" />
        </Field>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
          <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.accent, color: C.onAccent }}>{guardando ? 'Creando…' : 'Crear empleado'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditarEmpleadoModal({ empleado, onClose, onSave }) {
  const [form, setForm] = useState({ name: empleado.name, specialty: empleado.specialty || '', password: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Ingresa el nombre del empleado.');
    if (form.specialty.trim().length > 60) return setError('La especialidad es demasiado larga (máximo 60 caracteres).');
    if (form.password && !claveValida(form.password)) return setError(REGLA_CLAVE);
    const cambios = { name: form.name, specialty: form.specialty };
    if (form.password) cambios.password = form.password;
    setGuardando(true);
    const result = await onSave(empleado.id, cambios);
    setGuardando(false);
    if (!result.ok) { setError(result.error); return; }
    onClose();
  };

  return (
    <Modal title="Editar empleado" size="sm" onClose={onClose}>
      {error && <div role="alert" className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: C.redBg, color: C.red }}>{error}</div>}
      <form onSubmit={submit} noValidate className="space-y-3">
        <Field label="Nombre">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} autoComplete="off" />
        </Field>
        <Field label="Especialidad (opcional)">
          <input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} className={inputClass} style={inputStyle} placeholder="Ej. Fade y barba" autoComplete="off" />
        </Field>
        <Field label="Nueva contraseña (opcional)">
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputClass} style={inputStyle} autoComplete="new-password" />
        </Field>
        <p className="text-xs" style={{ color: C.textFaint }}>
          Si la cambias, se cierran las sesiones que {empleado.name} tenga abiertas. El correo no se puede modificar.
        </p>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
          <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.accent, color: C.onAccent }}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function EmpleadosView({ equipo, onCreate, onUpdate }) {
  const [modal, setModal] = useState(null); // 'nuevo' | { editar: empleado } | { baja: empleado }
  const [aviso, setAviso] = useState('');
  const [errorBaja, setErrorBaja] = useState('');

  const cambiarEstado = async (emp, active) => {
    setErrorBaja('');
    const result = await onUpdate(emp.id, { active });
    if (!result.ok) { setErrorBaja(result.error); return false; }
    if (!active) {
      const n = result.pendingAppointments || 0;
      setAviso(n > 0
        ? `${emp.name} ya no tiene acceso. Le quedan ${n} ${n === 1 ? 'cita pendiente' : 'citas pendientes'}: reasígnalas desde la agenda.`
        : `${emp.name} ya no tiene acceso. Su historial se conserva.`);
    } else {
      setAviso(`${emp.name} fue reactivado. Para entrar debe iniciar sesión de nuevo.`);
    }
    return true;
  };

  const activos = equipo.filter(e => e.active !== false).length;

  return (
    <div className="space-y-5 bd-fade-in">
      {modal === 'nuevo' && <NuevoEmpleadoModal onClose={() => setModal(null)} onSave={onCreate} />}
      {modal?.editar && <EditarEmpleadoModal empleado={modal.editar} onClose={() => setModal(null)} onSave={onUpdate} />}
      {modal?.baja && (
        <Modal title={`¿Desactivar a ${modal.baja.name}?`} size="sm" onClose={() => { setModal(null); setErrorBaja(''); }}>
          <p className="text-xs mb-5" style={{ color: C.textMuted }}>
            Perderá el acceso de inmediato y se cerrarán sus sesiones. Sus citas y su historial se conservan, y podrás reactivarlo cuando quieras.
          </p>
          {errorBaja && <p role="alert" className="text-xs mb-4" style={{ color: C.red }}>{errorBaja}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setModal(null); setErrorBaja(''); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
            <button onClick={async () => { if (await cambiarEstado(modal.baja, false)) setModal(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.red, color: '#fff' }}>Desactivar</button>
          </div>
        </Modal>
      )}

      {aviso && (
        <div role="status" className="flex items-start gap-2.5 text-sm p-3.5 rounded-lg" style={{ background: C.accentBg, color: C.text }}>
          <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: C.accent }} aria-hidden="true" />
          <span className="flex-1">{aviso}</span>
          <button onClick={() => setAviso('')} className="text-xs font-medium" style={{ color: C.textMuted }}>Entendido</button>
        </div>
      )}
      {errorBaja && !modal && <p role="alert" className="text-sm p-3 rounded-lg" style={{ background: C.redBg, color: C.red }}>{errorBaja}</p>}

      <SectionCard title="Equipo del negocio" action={
        <button onClick={() => setModal('nuevo')} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: C.accent, color: C.onAccent }}>
          <UserPlus size={14} /> Nuevo empleado
        </button>
      }>
        <p className="text-xs mb-3" style={{ color: C.textFaint }}>
          {activos} {activos === 1 ? 'activo' : 'activos'}{equipo.length > activos ? ` · ${equipo.length - activos} desactivado${equipo.length - activos === 1 ? '' : 's'}` : ''}
        </p>
        <div className="overflow-x-auto bd-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: C.textFaint }}>
                <th className="pb-3 font-medium">Barbero</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Correo</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {equipo.map(emp => {
                const activo = emp.active !== false;
                return (
                  <tr key={emp.id} className="bd-row" style={{ borderTop: `1px solid ${C.borderSoft}`, opacity: activo ? 1 : 0.6 }}>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-9 rounded-full flex-shrink-0" style={{ background: emp.color || C.accent }} aria-hidden="true" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{emp.name}</div>
                          <div className="text-xs truncate" style={{ color: C.textFaint }}>{emp.specialty || 'Sin especialidad'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 hidden sm:table-cell" style={{ color: C.textMuted }}>{emp.email}</td>
                    <td className="py-3">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: activo ? C.greenBg : 'rgba(70,84,79,0.10)', color: activo ? C.green : C.textMuted }}>
                        {activo ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button onClick={() => setModal({ editar: emp })} title="Editar" aria-label={`Editar a ${emp.name}`}
                        className="w-8 h-8 rounded-md inline-flex items-center justify-center mr-1" style={{ border: `1px solid ${C.border}` }}>
                        <Pencil size={13} style={{ color: C.textMuted }} aria-hidden="true" />
                      </button>
                      {activo ? (
                        <button onClick={() => { setErrorBaja(''); setModal({ baja: emp }); }} title="Desactivar" aria-label={`Desactivar a ${emp.name}`}
                          className="w-8 h-8 rounded-md inline-flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
                          <UserX size={13} style={{ color: C.red }} aria-hidden="true" />
                        </button>
                      ) : (
                        <button onClick={() => cambiarEstado(emp, true)} title="Reactivar" aria-label={`Reactivar a ${emp.name}`}
                          className="w-8 h-8 rounded-md inline-flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
                          <UserCheck size={13} style={{ color: C.accent }} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {equipo.length === 0 && (
                <tr><td colSpan={4}><EmptyState icon={Users} text="Todavía no tienes empleados registrados." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
