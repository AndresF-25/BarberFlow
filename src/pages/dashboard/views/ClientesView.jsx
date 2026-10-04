import { useState, useEffect } from 'react';
import {
  Users, X, Search, Clock, Phone, AlertTriangle, UserCheck, MessageCircle,
} from 'lucide-react';
import { api } from '../../../api/client';
import { C, fmtCOP } from '../theme';
import { TagPill, SectionCard, EmptyState } from '../components/ui';

/* =========================================================================
   VISTA: CLIENTES
   ========================================================================= */
// Número para WhatsApp (Colombia): 10 dígitos -> prefijo 57. Devuelve null si no hay un número usable.
function whatsappUrl(telefono) {
  const digits = (telefono || '').replace(/\D/g, '');
  if (digits.length === 10) return `https://wa.me/57${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `https://wa.me/${digits}`;
  return null;
}

function ClienteDrawer({ cliente, onClose }) {
  const [detalle, setDetalle] = useState({ loading: true, error: '', historial: [] });

  useEffect(() => {
    let cancelled = false;
    setDetalle({ loading: true, error: '', historial: [] });
    api.getClient(cliente.id)
      .then(({ historial }) => { if (!cancelled) setDetalle({ loading: false, error: '', historial: historial || [] }); })
      .catch(err => { if (!cancelled) setDetalle({ loading: false, error: err.message, historial: [] }); });
    return () => { cancelled = true; };
  }, [cliente.id]);

  const wa = whatsappUrl(cliente.telefono);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="w-full max-w-sm h-full p-6 overflow-y-auto bd-scroll bd-fade-in" style={{ background: C.surface, borderLeft: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="bd-display text-base font-semibold">Perfil del cliente</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: C.gold, color: '#1A1207' }}>
            {cliente.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <div className="text-sm font-semibold">{cliente.nombre}</div>
            <TagPill tag={cliente.etiqueta} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            ['Teléfono', cliente.telefono], ['Última visita', cliente.ultima],
            ['Frecuencia', cliente.frecuencia], ['Visitas totales', cliente.visitas],
            ['Servicio favorito', cliente.favorito], ['Gasto promedio', fmtCOP(cliente.gasto)],
          ].map(([label, val]) => (
            <div key={label} className="p-3 rounded-lg" style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}` }}>
              <div className="text-[10px]" style={{ color: C.textFaint }}>{label}</div>
              <div className="text-xs font-medium mt-1">{val}</div>
            </div>
          ))}
        </div>
        <h4 className="text-xs font-semibold mb-3" style={{ color: C.textMuted }}>HISTORIAL</h4>
        <div className="space-y-2">
          {detalle.loading && <EmptyState icon={Clock} text="Cargando historial…" />}
          {!detalle.loading && detalle.error && <EmptyState icon={AlertTriangle} text={`No se pudo cargar el historial: ${detalle.error}`} />}
          {!detalle.loading && !detalle.error && detalle.historial.map((h, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{ border: `1px solid ${C.borderSoft}` }}>
              <div>
                <div className="text-xs font-medium">{h.servicio}</div>
                <div className="text-[10px]" style={{ color: C.textFaint }}>{h.fecha}{h.tipo === 'servicio' ? ` · ${h.barbero}` : ' · Producto'}</div>
              </div>
              <div className="text-xs font-semibold" style={{ color: C.gold }}>{fmtCOP(h.valor)}</div>
            </div>
          ))}
          {!detalle.loading && !detalle.error && detalle.historial.length === 0 && <EmptyState icon={Clock} text="Este cliente todavía no tiene servicios finalizados." />}
        </div>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="w-full mt-6 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: C.gold, color: '#1A1207' }}>
            <MessageCircle size={15} /> Enviar mensaje por WhatsApp
          </a>
        ) : (
          <button disabled className="w-full mt-6 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: C.borderSoft, color: C.textFaint }} title="El cliente no tiene un teléfono válido">
            <MessageCircle size={15} /> Sin teléfono para contactar
          </button>
        )}
      </div>
    </div>
  );
}

export function ClientesView() {
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

  const filtrados = estado.clientes.filter(c => tag === 'Todos' || c.etiqueta === tag);

  return (
    <div className="space-y-5 bd-fade-in">
      {seleccionado && <ClienteDrawer cliente={seleccionado} onClose={() => setSeleccionado(null)} />}

      <SectionCard>
        <div className="flex items-center gap-3">
          <UserCheck size={16} style={{ color: C.gold }} />
          <div className="text-xs" style={{ color: C.textMuted }}>
            Esta lista se actualiza sola: cada vez que registras una <strong style={{ color: C.text }}>nueva cita</strong> o una venta con nombre de cliente, se guarda su ficha. Las visitas y el gasto se cuentan cuando la cita se <strong style={{ color: C.text }}>finaliza</strong>.
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Search size={14} style={{ color: C.textFaint }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nombre o teléfono..." className="bg-transparent text-sm outline-none w-full" style={{ color: C.text }} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['Todos', 'Nuevo', 'Frecuente', 'VIP', 'Inactivo'].map(t => (
            <button key={t} onClick={() => setTag(t)} className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: tag === t ? 'rgba(199,154,91,0.14)' : 'transparent', color: tag === t ? C.gold : C.textFaint, border: `1px solid ${tag === t ? C.gold + '55' : C.border}` }}>{t}</button>
          ))}
        </div>
      </div>

      <SectionCard>
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
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {!estado.loading && !estado.error && filtrados.map(c => (
                <tr key={c.id} className="bd-row" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background: C.bgSoft, color: C.gold, border: `1px solid ${C.border}` }}>
                        {c.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <span className="font-medium whitespace-nowrap">{c.nombre}</span>
                    </div>
                  </td>
                  <td className="py-3 hidden md:table-cell" style={{ color: C.textMuted }}>
                    <span className="inline-flex items-center gap-1"><Phone size={11} style={{ color: C.textFaint }} />{c.telefono}</span>
                  </td>
                  <td className="py-3 hidden lg:table-cell" style={{ color: C.textMuted }}>{c.favorito}</td>
                  <td className="py-3 hidden lg:table-cell" style={{ color: C.textMuted }}>{c.ultima}</td>
                  <td className="py-3 font-medium">{fmtCOP(c.gasto)}</td>
                  <td className="py-3"><TagPill tag={c.etiqueta} /></td>
                  <td className="py-3 text-right">
                    <button onClick={() => setSeleccionado(c)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ border: `1px solid ${C.border}`, color: C.gold }}>Ver historial</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {estado.loading && <EmptyState icon={Clock} text="Cargando clientes…" />}
          {!estado.loading && estado.error && <EmptyState icon={AlertTriangle} text={`No se pudieron cargar los clientes: ${estado.error}`} />}
          {!estado.loading && !estado.error && filtrados.length === 0 && (
            <EmptyState icon={Users} text={busquedaActiva || tag !== 'Todos' ? 'No se encontraron clientes.' : 'Todavía no tienes clientes. Aparecerán al registrar tu primera cita.'} />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
