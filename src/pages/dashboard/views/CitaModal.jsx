import { useState } from 'react';
import {
  X,
} from 'lucide-react';
import { todayIso } from '../../../api/client';
import { C } from '../theme';

/* =========================================================================
   VISTA: AGENDA
   ========================================================================= */
export function CitaModal({ servicios, empleados, esEmpleado, userId, onClose, onSave }) {
  const [form, setForm] = useState({
    cliente: '', telefono: '', serviceId: servicios[0]?.id || '', employeeId: esEmpleado ? userId : (empleados[0]?.id || ''),
    fecha: todayIso(), hora: '10:00',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const faltanDatos = servicios.length === 0 || (!esEmpleado && empleados.length === 0);
  const puedeGuardar = !guardando && !faltanDatos && form.cliente.trim().length > 0 && form.serviceId && form.employeeId && form.fecha && form.hora;

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const result = await onSave({
      clientName: form.cliente.trim(),
      clientPhone: form.telefono.trim(),
      serviceId: form.serviceId,
      employeeId: form.employeeId,
      appointmentDate: form.fecha,
      startTime: form.hora,
    });
    setGuardando(false);
    if (result?.ok) onClose();
    else setError(result?.error || 'No se pudo guardar la cita.');
  };

  const inputStyle = { background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 bd-fade-in" style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="bd-display text-base font-semibold">Nueva cita</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>
        {faltanDatos && (
          <p className="text-xs mb-4 p-3 rounded-lg" style={{ background: C.amberBg, color: C.amber }}>
            {servicios.length === 0
              ? 'Primero crea al menos un servicio en la sección Servicios.'
              : 'Primero crea al menos un empleado (barbero) en la sección Empleados.'}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Nombre del cliente</label>
            <input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Ej. Andrés Villa" />
          </div>
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Teléfono</label>
            <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="300 000 0000" />
          </div>
          <div className={`grid gap-3 ${esEmpleado ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Servicio</label>
              <select value={form.serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.duracion} min)</option>)}
              </select>
            </div>
            {!esEmpleado && (
              <div>
                <label className="text-xs" style={{ color: C.textMuted }}>Barbero</label>
                <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                  {empleados.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Fecha</label>
              <input type="date" min={todayIso()} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Hora</label>
              <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
          </div>
        </div>
        {error && <p className="text-xs mt-4" style={{ color: C.red }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
          <button disabled={!puedeGuardar} onClick={guardar} className="flex-1 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: puedeGuardar ? C.gold : C.borderSoft, color: puedeGuardar ? '#1A1207' : C.textFaint }}>
            {guardando ? 'Guardando…' : 'Guardar cita'}
          </button>
        </div>
      </div>
    </div>
  );
}
