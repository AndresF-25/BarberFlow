import { useState, useEffect } from 'react';
import {
  Users, Search, Clock, Phone, AlertTriangle, UserCheck, MessageCircle, Pencil, CheckCircle2,
} from 'lucide-react';
import { api } from '../../../api/client';
import { C, fmtCOP } from '../theme';
import { fmtFecha } from '../dates';
import { Modal, Field } from '../components/Modal';
import { TagPill, SectionCard, EmptyState } from '../components/ui';

/* =========================================================================
   VISTA: CLIENTES
   La lista se arma sola (cada cita o venta con nombre crea la ficha); el dueño puede corregirla.
   Las reglas de validación replican las del servidor (routes/clients.js); el servidor es quien decide.
   ========================================================================= */
const ETIQUETAS = ['Todos', 'Nuevo', 'Frecuente', 'VIP', 'Inactivo'];
const TELEFONO = /^[0-9+()\-\s]{7,20}$/;
const inputStyle = { background: C.bg, border: `1px solid ${C.border}`, color: C.text };
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none';

const iniciales = (nombre) => (nombre || '').split(/\s+/).filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';

// Número para WhatsApp (Colombia): 10 dígitos -> prefijo 57. Devuelve null si no hay un número usable.
function whatsappUrl(telefono) {
  const digits = (telefono || '').replace(/\D/g, '');
  if (digits.length === 10) return `https://wa.me/57${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `https://wa.me/${digits}`;
  return null;
}

function validar(form) {
  const nombre = form.name.replace(/\s+/g, ' ').trim();
  if (!nombre) return 'Ingresa el nombre del cliente.';
  if (nombre.length > 80) return 'El nombre del cliente es demasiado largo (máximo 80 caracteres).';
  if (form.phone.trim() && !TELEFONO.test(form.phone.trim())) return 'El teléfono solo puede tener números, espacios, +, - y paréntesis (7 a 20 caracteres).';
  if (form.notes.trim().length > 500) return 'Las notas son demasiado largas (máximo 500 caracteres).';
  return '';
}

function EditarCliente({ cliente, onCancel, onSave }) {
  const [form, setForm] = useState({
    name: cliente.nombre,
    phone: cliente.telefono === '—' ? '' : cliente.telefono,
    notes: cliente.notas || '',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    const problema = validar(form);
    if (problema) return setError(problema);
    setGuardando(true);
    setError('');
    const result = await onSave({ name: form.name, phone: form.phone, notes: form.notes });
    setGuardando(false);
    if (!result.ok) setError(result.error || 'No se pudo guardar la ficha.');
  };

  return (
    <form onSubmit={guardar} noValidate className="space-y-3 mb-6">
      {error && <div role="alert" className="text-xs px-3 py-2 rounded-lg" style={{ background: C.redBg, color: C.red }}>{error}</div>}
      <Field label="Nombre">
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} autoComplete="off" />
      </Field>
      <Field label="Teléfono">
        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} style={inputStyle} placeholder="Ej. 300 123 4567" autoComplete="off" />
      </Field>
      <Field label="Notas">
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className={inputClass} style={inputStyle} placeholder="Preferencias, alergias, cómo le gusta el corte…" />
      </Field>
      <p className="text-xs text-right" style={{ color: form.notes.length > 500 ? C.red : C.textFaint }}>{form.notes.length}/500</p>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
        <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.accent, color: C.onAccent }}>{guardando ? 'Guardando…' : 'Guardar ficha'}</button>
      </div>
    </form>
  );
}

function ClienteDrawer({ cliente, esOwner, onClose, onUpdated }) {
  const [detalle, setDetalle] = useState({ loading: true, error: '', historial: [] });
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDetalle({ loading: true, error: '', historial: [] });
    api.getClient(cliente.id)
      .then(({ historial }) => { if (!cancelled) setDetalle({ loading: false, error: '', historial: historial || [] }); })
      .catch(err => { if (!cancelled) setDetalle({ loading: false, error: err.message, historial: [] }); });
    return () => { cancelled = true; };
  }, [cliente.id]);

  const guardar = async (cambios) => {
    try {
      const { client } = await api.updateClient(cliente.id, cambios);
      onUpdated(client);
      setEditando(false);
      setAviso('Ficha actualizada.');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  const wa = whatsappUrl(cliente.telefono === '—' ? '' : cliente.telefono);

  return (
    <Modal title="Perfil del cliente" side showClose onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: C.accent, color: C.onAccent }} aria-hidden="true">
          {iniciales(cliente.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{cliente.nombre}</div>
          <TagPill tag={cliente.etiqueta} />
        </div>
        {esOwner && !editando && (
          <button onClick={() => { setAviso(''); setEditando(true); }} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg flex-shrink-0" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>
            <Pencil size={13} aria-hidden="true" /> Editar ficha
          </button>
        )}
      </div>

      {aviso && (
        <div role="status" className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg mb-4" style={{ background: C.accentBg, color: C.text }}>
          <CheckCircle2 size={16} style={{ color: C.accent }} aria-hidden="true" /> {aviso}
        </div>
      )}

      {editando ? (
        <EditarCliente cliente={cliente} onCancel={() => setEditando(false)} onSave={guardar} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              ['Teléfono', cliente.telefono], ['Última visita', fmtFecha(cliente.ultima)],
              ['Frecuencia', cliente.frecuencia], ['Visitas totales', cliente.visitas],
              ['Servicio favorito', cliente.favorito], ['Gasto promedio', fmtCOP(cliente.gasto)],
            ].map(([label, val]) => (
              <div key={label} className="p-3 rounded-lg" style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}` }}>
                <div className="text-[10px]" style={{ color: C.textFaint }}>{label}</div>
                <div className="text-xs font-medium mt-1">{val}</div>
              </div>
            ))}
          </div>
          {cliente.notas && (
            <div className="p-3 rounded-lg mb-6" style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}` }}>
              <div className="text-[10px]" style={{ color: C.textFaint }}>Notas</div>
              <div className="text-xs mt-1 whitespace-pre-wrap">{cliente.notas}</div>
            </div>
          )}
        </>
      )}

      <h4 className="text-xs font-semibold mb-3 mt-2" style={{ color: C.textMuted }}>Historial</h4>
      <div className="space-y-2">
        {detalle.loading && <EmptyState icon={Clock} text="Cargando historial…" />}
        {!detalle.loading && detalle.error && <EmptyState icon={AlertTriangle} text={`No se pudo cargar el historial: ${detalle.error}`} />}
        {!detalle.loading && !detalle.error && detalle.historial.map((h, i) => (
          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{ border: `1px solid ${C.borderSoft}` }}>
            <div>
              <div className="text-xs font-medium">{h.servicio}</div>
              <div className="text-[10px]" style={{ color: C.textFaint }}>{fmtFecha(h.fecha)}{h.tipo === 'servicio' ? ` · ${h.barbero}` : ' · Producto'}</div>
            </div>
            <div className="text-xs font-semibold" style={{ color: C.accent }}>{fmtCOP(h.valor)}</div>
          </div>
        ))}
        {!detalle.loading && !detalle.error && detalle.historial.length === 0 && <EmptyState icon={Clock} text="Este cliente todavía no tiene servicios finalizados." />}
      </div>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="w-full mt-6 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: C.accent, color: C.onAccent }}>
          <MessageCircle size={15} aria-hidden="true" /> Enviar mensaje por WhatsApp
        </a>
      ) : (
        <button disabled className="w-full mt-6 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: C.borderSoft, color: C.textFaint }} title="El cliente no tiene un teléfono válido">
          <MessageCircle size={15} aria-hidden="true" /> Sin teléfono para contactar
        </button>
      )}
    </Modal>
  );
}

export function ClientesView({ esOwner = false }) {
  const [busca, setBusca] = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState('');
  const [tag, setTag] = useState('Todos');
  const [seleccionado, setSeleccionado] = useState(null);
  const [estado, setEstado] = useState({ clientes: [], loading: true, error: '' });

  // Espera 300 ms tras el último carácter antes de consultar la API.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaActiva(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let cancelled = false;
    setEstado(s => ({ ...s, loading: true }));
    api.listClients(busquedaActiva ? { search: busquedaActiva } : {})
      .then(({ clients }) => { if (!cancelled) setEstado({ clientes: clients || [], loading: false, error: '' }); })
      .catch(err => { if (!cancelled) setEstado({ clientes: [], loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, [busquedaActiva]);

  // Tras editar una ficha se actualiza la fila y el perfil abierto, sin volver a pedir la lista.
  const alActualizar = (cliente) => {
    setEstado(s => ({ ...s, clientes: s.clientes.map(c => c.id === cliente.id ? cliente : c) }));
    setSeleccionado(cliente);
  };

  const filtrados = estado.clientes.filter(c => tag === 'Todos' || c.etiqueta === tag);
  const hayDatos = estado.clientes.length > 0;

  return (
    <div className="space-y-5 bd-fade-in">
      {seleccionado && <ClienteDrawer cliente={seleccionado} esOwner={esOwner} onClose={() => setSeleccionado(null)} onUpdated={alActualizar} />}

      <SectionCard>
        <div className="flex items-center gap-3">
          <UserCheck size={16} style={{ color: C.accent }} aria-hidden="true" />
          <div className="text-xs" style={{ color: C.textMuted }}>
            Esta lista se actualiza sola: cada vez que registras una <strong style={{ color: C.text }}>nueva cita</strong> o una venta con nombre de cliente, se guarda su ficha. Las visitas y el gasto se cuentan cuando la cita se <strong style={{ color: C.text }}>finaliza</strong>.
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Search size={14} style={{ color: C.textFaint }} aria-hidden="true" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nombre o teléfono..." aria-label="Buscar cliente por nombre o teléfono" className="bg-transparent text-sm outline-none w-full" style={{ color: C.text }} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtrar por etiqueta">
          {ETIQUETAS.map(t => (
            <button key={t} onClick={() => setTag(t)} aria-pressed={tag === t} className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: tag === t ? C.accentBg : 'transparent', color: tag === t ? C.accent : C.textFaint, border: `1px solid ${tag === t ? C.accent + '55' : C.border}` }}>{t}</button>
          ))}
        </div>
      </div>

      <SectionCard>
        {!estado.error && hayDatos && (
          <p className="text-xs mb-3" role="status" style={{ color: C.textFaint }}>
            {filtrados.length} {filtrados.length === 1 ? 'cliente' : 'clientes'}{busquedaActiva || tag !== 'Todos' ? ' con este filtro' : ''}
          </p>
        )}
        <div className="overflow-x-auto bd-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: C.textFaint }}>
                <th className="pb-3 font-medium">Cliente</th>
                <th className="pb-3 font-medium hidden md:table-cell">Teléfono</th>
                <th className="pb-3 font-medium hidden lg:table-cell">Último servicio</th>
                <th className="pb-3 font-medium hidden lg:table-cell">Última visita</th>
                <th className="pb-3 font-medium">Gasto prom.</th>
                <th className="pb-3 font-medium">Etiqueta</th>
                <th className="pb-3 font-medium"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody style={{ opacity: estado.loading && hayDatos ? 0.6 : 1 }}>
              {!estado.error && filtrados.map(c => (
                <tr key={c.id} className="bd-row" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background: C.bgSoft, color: C.accent, border: `1px solid ${C.border}` }} aria-hidden="true">
                        {iniciales(c.nombre)}
                      </div>
                      <span className="font-medium whitespace-nowrap">{c.nombre}</span>
                    </div>
                  </td>
                  <td className="py-3 hidden md:table-cell" style={{ color: C.textMuted }}>
                    <span className="inline-flex items-center gap-1"><Phone size={11} style={{ color: C.textFaint }} aria-hidden="true" />{c.telefono}</span>
                  </td>
                  <td className="py-3 hidden lg:table-cell" style={{ color: C.textMuted }}>{c.ultimoServicio}</td>
                  <td className="py-3 hidden lg:table-cell" style={{ color: C.textMuted }}>{fmtFecha(c.ultima)}</td>
                  <td className="py-3 font-medium">{fmtCOP(c.gasto)}</td>
                  <td className="py-3"><TagPill tag={c.etiqueta} /></td>
                  <td className="py-3 text-right">
                    <button onClick={() => setSeleccionado(c)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ border: `1px solid ${C.border}`, color: C.accent }}>
                      Ver historial<span className="sr-only"> de {c.nombre}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {estado.loading && !hayDatos && <EmptyState icon={Clock} text="Cargando clientes…" />}
          {!estado.loading && estado.error && <EmptyState icon={AlertTriangle} text={`No se pudieron cargar los clientes: ${estado.error}`} />}
          {!estado.loading && !estado.error && filtrados.length === 0 && (
            <EmptyState icon={Users} text={busquedaActiva || tag !== 'Todos' ? 'No se encontraron clientes.' : 'Todavía no tienes clientes. Aparecerán al registrar tu primera cita.'} />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
