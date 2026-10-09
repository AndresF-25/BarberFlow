import { useState } from 'react';
import { todayIso } from '../../../api/client';
import { C } from '../theme';
import { addDaysIso } from '../dates';
import { Modal, Field } from '../components/Modal';

/* =========================================================================
   MODAL: NUEVA CITA
   Las reglas replican las del servidor (routes/appointments.js); el servidor es quien decide.
   ========================================================================= */
const TELEFONO = /^[0-9+()\-\s]{7,20}$/;
const MAX_DIAS = 365;
const inputStyle = { background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text };
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none';

/** Próxima media hora (hoy a las 3:10 p. m. → 15:30), sin pasar de las 23:30: así el primer intento no cae en el pasado. */
function horaInicial() {
  const ahora = new Date();
  const minutos = Math.min(Math.ceil((ahora.getHours() * 60 + ahora.getMinutes() + 1) / 30) * 30, 23 * 60 + 30);
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

export function CitaModal({ servicios, empleados, esEmpleado, userId, onClose, onSave }) {
  const [form, setForm] = useState({
    cliente: '', telefono: '', serviceId: servicios[0]?.id || '', employeeId: esEmpleado ? userId : (empleados[0]?.id || ''),
    fecha: todayIso(), hora: horaInicial(),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const faltanDatos = servicios.length === 0 || (!esEmpleado && empleados.length === 0);
  // Si el modal se abre antes de que lleguen los servicios o el equipo, el estado nace vacío aunque el desplegable
  // ya muestre la primera opción: se usa la elegida o, si no hay, la primera disponible.
  const serviceId = form.serviceId || servicios[0]?.id || '';
  const employeeId = form.employeeId || (esEmpleado ? userId : empleados[0]?.id) || '';

  const validar = () => {
    const nombre = form.cliente.replace(/\s+/g, ' ').trim();
    if (!nombre) return 'Ingresa el nombre del cliente.';
    if (nombre.length > 80) return 'El nombre del cliente es demasiado largo (máximo 80 caracteres).';
    if (form.telefono.trim() && !TELEFONO.test(form.telefono.trim())) return 'El teléfono solo puede tener números, espacios, +, - y paréntesis (7 a 20 caracteres).';
    if (!serviceId) return 'Elige un servicio.';
    if (!employeeId) return 'Elige un barbero.';
    if (!form.fecha) return 'Elige la fecha.';
    if (form.fecha < todayIso()) return 'No se pueden crear citas en el pasado.';
    if (form.fecha > addDaysIso(todayIso(), MAX_DIAS)) return 'No se puede agendar a más de un año vista.';
    if (!form.hora) return 'Elige la hora.';
    return '';
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (faltanDatos) return;
    const problema = validar();
    if (problema) return setError(problema);
    setGuardando(true);
    setError('');
    const result = await onSave({
      clientName: form.cliente.trim(),
      clientPhone: form.telefono.trim(),
      serviceId,
      employeeId,
      appointmentDate: form.fecha,
      startTime: form.hora,
    });
    setGuardando(false);
    if (result?.ok) onClose();
    else setError(result?.error || 'No se pudo guardar la cita.');
  };

  return (
    <Modal title="Nueva cita" onClose={onClose} showClose>
      {faltanDatos && (
        <p className="text-xs mb-4 p-3 rounded-lg" style={{ background: C.amberBg, color: C.amber }}>
          {servicios.length === 0
            ? 'Primero crea al menos un servicio en la sección Servicios.'
            : 'Primero crea al menos un empleado (barbero) en la sección Empleados.'}
        </p>
      )}
      <form onSubmit={guardar} noValidate>
        <div className="space-y-3">
          <Field label="Nombre del cliente">
            <input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} className={inputClass} style={inputStyle} placeholder="Ej. Andrés Villa" autoComplete="off" />
          </Field>
          <Field label="Teléfono">
            <input type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className={inputClass} style={inputStyle} placeholder="300 000 0000" autoComplete="off" />
          </Field>
          <div className={`grid gap-3 ${esEmpleado ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <Field label="Servicio">
              <select value={serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })} className={inputClass} style={inputStyle}>
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.duracion} min)</option>)}
              </select>
            </Field>
            {!esEmpleado && (
              <Field label="Barbero">
                <select value={employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className={inputClass} style={inputStyle}>
                  {empleados.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input type="date" min={todayIso()} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Hora">
              <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} className={inputClass} style={inputStyle} />
            </Field>
          </div>
        </div>
        {error && <p role="alert" className="text-xs mt-4" style={{ color: C.red }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
          <button type="submit" disabled={guardando || faltanDatos} className="flex-1 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: guardando || faltanDatos ? C.borderSoft : C.accent, color: guardando || faltanDatos ? C.textFaint : C.onAccent }}>
            {guardando ? 'Guardando…' : 'Guardar cita'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
