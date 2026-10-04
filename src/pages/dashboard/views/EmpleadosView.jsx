import { useState } from 'react';
import {
  Users, UserPlus,
} from 'lucide-react';
import { C } from '../theme';
import { SectionCard, EmptyState } from '../components/ui';

/* =========================================================================
   VISTA: EMPLEADOS (solo owner)
   Gestión mínima del equipo del negocio: alta de empleados y listado.
   Los empleados creados aquí quedan atados automáticamente al businessId
   del owner (ver AuthContext.createEmployee) — nunca eligen su propio rol
   ni negocio.
   ========================================================================= */
function EmpleadosModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Ingresá el nombre del empleado.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Ingresá un correo válido.');
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return setError('La contraseña debe tener al menos 8 caracteres, con letras y números.');
    }
    const result = await onSave(form);
    if (!result.ok) { setError(result.error); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl p-6 bd-fade-in" style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <h3 className="bd-display text-base font-semibold mb-4">Nuevo empleado</h3>
        {error && <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: C.redBg, color: C.red }}>{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: C.textMuted }}>Nombre</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: C.textMuted }}>Correo</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: C.textMuted }}>Contraseña temporal</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
            <button type="submit" className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.gold, color: '#1A1207' }}>Crear empleado</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EmpleadosView({ empleados, onCreate }) {
  const [modal, setModal] = useState(false);

  return (
    <div className="space-y-5 bd-fade-in">
      {modal && <EmpleadosModal onClose={() => setModal(false)} onSave={onCreate} />}
      <SectionCard title="Equipo del negocio" action={
        <button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: C.gold, color: '#1A1207' }}>
          <UserPlus size={14} /> Nuevo empleado
        </button>
      }>
        <div className="overflow-x-auto bd-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: C.textFaint }}>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">Correo</th>
                <th className="pb-3 font-medium">Rol</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map(emp => (
                <tr key={emp.id} className="bd-row" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td className="py-3 font-medium">{emp.name}</td>
                  <td className="py-3" style={{ color: C.textMuted }}>{emp.email}</td>
                  <td className="py-3" style={{ color: C.textMuted }}>Empleado</td>
                </tr>
              ))}
              {empleados.length === 0 && (
                <tr><td colSpan={3}><EmptyState icon={Users} text="Todavía no tenés empleados registrados." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
