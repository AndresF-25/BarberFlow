import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { C } from '../theme';
import { Modal, Field } from './Modal';
import { useAuth } from '../../../context/AuthContext';

const inputStyle = { background: C.bg, border: `1px solid ${C.border}`, color: C.text };
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none';

/** Cambio de contraseña propio (cualquier rol). Al terminar, el servidor cierra las demás sesiones. */
export function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ actual: '', nueva: '', repetir: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.actual) return setError('Ingresa tu contraseña actual.');
    if (form.nueva.length < 8 || !/[A-Za-z]/.test(form.nueva) || !/\d/.test(form.nueva)) {
      return setError('La nueva contraseña debe tener al menos 8 caracteres, con letras y números.');
    }
    if (form.nueva !== form.repetir) return setError('Las contraseñas nuevas no coinciden.');
    setGuardando(true);
    const result = await changePassword({ currentPassword: form.actual, newPassword: form.nueva });
    setGuardando(false);
    if (!result.ok) { setError(result.error); return; }
    setListo(true);
  };

  return (
    <Modal title="Cambiar contraseña" size="sm" onClose={onClose}>
      {listo ? (
        <div>
          <div role="status" className="flex items-start gap-2.5 text-sm mb-5">
            <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" style={{ color: C.accent }} aria-hidden="true" />
            <span>Contraseña actualizada. Cerramos tus sesiones en otros dispositivos; esta sigue abierta.</span>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ background: C.accent, color: C.onAccent }}>Listo</button>
        </div>
      ) : (
        <>
          {error && <div role="alert" className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: C.redBg, color: C.red }}>{error}</div>}
          <form onSubmit={submit} noValidate className="space-y-3">
            <Field label="Contraseña actual">
              <input type="password" value={form.actual} onChange={e => setForm({ ...form, actual: e.target.value })} className={inputClass} style={inputStyle} autoComplete="current-password" />
            </Field>
            <Field label="Contraseña nueva">
              <input type="password" value={form.nueva} onChange={e => setForm({ ...form, nueva: e.target.value })} className={inputClass} style={inputStyle} autoComplete="new-password" />
            </Field>
            <Field label="Repite la contraseña nueva">
              <input type="password" value={form.repetir} onChange={e => setForm({ ...form, repetir: e.target.value })} className={inputClass} style={inputStyle} autoComplete="new-password" />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
              <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.accent, color: C.onAccent }}>{guardando ? 'Guardando…' : 'Cambiar contraseña'}</button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
