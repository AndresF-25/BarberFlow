import { useState } from 'react';
import {
  DollarSign, X, Plus, Clock, AlertTriangle, Flame, ShoppingBag, PackageMinus,
} from 'lucide-react';
import { C, INV, fmtCOP, fmtCompact } from '../theme';
import { SectionCard, EmptyState } from '../components/ui';

/* =========================================================================
   VISTA: VENTAS EXTRA (productos ajenos al servicio de corte)
   ========================================================================= */
function VentaModal({ productos, onClose, onSave }) {
  const disponibles = productos.filter(p => p.stock > 0);
  const [form, setForm] = useState({ productoId: disponibles[0]?.id || '', cantidad: 1, cliente: '' });
  const productoSel = productos.find(p => p.id === form.productoId);
  const maxCantidad = productoSel?.stock || 1;
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const puedeGuardar = !guardando && productoSel && Number.isInteger(form.cantidad) && form.cantidad > 0 && form.cantidad <= maxCantidad;

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const result = await onSave({
      productId: productoSel.id,
      quantity: form.cantidad,
      ...(form.cliente.trim() ? { clientName: form.cliente.trim() } : {}),
    });
    setGuardando(false);
    if (result?.ok) onClose();
    else setError(result?.error || 'No se pudo registrar la venta.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 bd-fade-in" style={{ background: INV.surface, border: `1px solid ${INV.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="bd-display text-base font-semibold">Registrar venta</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>
        {disponibles.length === 0 ? (
          <EmptyState icon={PackageMinus} text="No hay productos con stock disponible." />
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Producto</label>
              <select value={form.productoId} onChange={e => setForm({ ...form, productoId: e.target.value, cantidad: 1 })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }}>
                {disponibles.map(p => <option key={p.id} value={p.id}>{p.nombre} — {fmtCOP(p.precioVenta)} ({p.stock} disp.)</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs" style={{ color: C.textMuted }}>Cantidad</label>
                <input type="number" min="1" max={maxCantidad} value={form.cantidad}
                  onChange={e => setForm({ ...form, cantidad: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }} />
              </div>
              <div>
                <label className="text-xs" style={{ color: C.textMuted }}>Total</label>
                <div className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: INV.accentBright }}>
                  {fmtCOP((productoSel?.precioVenta || 0) * form.cantidad)}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Cliente (opcional)</label>
              <input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }} placeholder="Ej. Sebastián Gómez" />
            </div>
          </div>
        )}
        {error && <p className="text-xs mt-4" style={{ color: C.red }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
          <button
            disabled={!puedeGuardar}
            onClick={guardar}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ background: puedeGuardar ? INV.accent : C.borderSoft, color: puedeGuardar ? '#fff' : C.textFaint }}>
            <ShoppingBag size={14} /> {guardando ? 'Registrando…' : 'Registrar venta'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VentasView({ productos, ventas, estado = { loading: false, error: '' }, onAddVenta }) {
  const [modal, setModal] = useState(false);
  const totalVentas = ventas.reduce((a, v) => a + v.total, 0);
  const unidadesVendidas = ventas.reduce((a, v) => a + v.cantidad, 0);
  const productoTop = ventas.length
    ? Object.entries(ventas.reduce((acc, v) => { acc[v.producto] = (acc[v.producto] || 0) + v.cantidad; return acc; }, {}))
        .sort((a, b) => b[1] - a[1])[0][0]
    : '—';

  return (
    <div className="space-y-5 bd-fade-in">
      {modal && <VentaModal productos={productos} onClose={() => setModal(false)} onSave={onAddVenta} />}

      <SectionCard>
        <div className="flex items-center gap-3">
          <ShoppingBag size={16} style={{ color: INV.accentBright }} />
          <div className="text-xs" style={{ color: C.textMuted }}>
            Ventas de productos que no son parte del servicio de corte — gel, cera, cerveza, y demás. Cada venta descuenta el stock automáticamente en Inventario. Si indicas un cliente, queda en su historial.
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bd-card bd-fade-in p-5 rounded-xl relative overflow-hidden" style={{ background: INV.surface, border: `1px solid ${INV.border}` }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: INV.accentBg }}>
            <DollarSign size={18} style={{ color: INV.accentBright }} />
          </div>
          <div className="bd-display text-2xl font-semibold leading-none mb-1.5">{fmtCompact(totalVentas)}</div>
          <div className="text-xs" style={{ color: C.textMuted }}>Ingresos por ventas extra</div>
        </div>
        <div className="bd-card bd-fade-in p-5 rounded-xl relative overflow-hidden" style={{ background: INV.surface, border: `1px solid ${INV.border}` }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: INV.accentBg }}>
            <ShoppingBag size={18} style={{ color: INV.accentBright }} />
          </div>
          <div className="bd-display text-2xl font-semibold leading-none mb-1.5">{unidadesVendidas}</div>
          <div className="text-xs" style={{ color: C.textMuted }}>Unidades vendidas</div>
        </div>
        <div className="bd-card bd-fade-in p-5 rounded-xl relative overflow-hidden" style={{ background: INV.surface, border: `1px solid ${INV.border}` }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: INV.accentBg }}>
            <Flame size={18} style={{ color: INV.accentBright }} />
          </div>
          <div className="bd-display text-base font-semibold leading-none mb-1.5">{productoTop}</div>
          <div className="text-xs" style={{ color: C.textMuted }}>Producto más vendido</div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: INV.surface, border: `1px solid ${INV.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="bd-display text-sm font-semibold tracking-wide">Historial de ventas</h3>
          <button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: INV.accent, color: '#fff' }}>
            <Plus size={14} /> Registrar venta
          </button>
        </div>
        <div className="overflow-x-auto bd-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: C.textFaint }}>
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Producto</th>
                <th className="pb-3 font-medium">Cantidad</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Cliente</th>
                <th className="pb-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map(v => (
                <tr key={v.id} className="bd-row" style={{ borderTop: `1px solid ${INV.border}` }}>
                  <td className="py-3" style={{ color: C.textMuted }}>{v.fecha}</td>
                  <td className="py-3 font-medium">{v.producto}</td>
                  <td className="py-3" style={{ color: C.textMuted }}>{v.cantidad}</td>
                  <td className="py-3 hidden sm:table-cell" style={{ color: C.textMuted }}>{v.cliente || '—'}</td>
                  <td className="py-3 font-medium" style={{ color: INV.accentBright }}>{fmtCOP(v.total)}</td>
                </tr>
              ))}
              {estado.loading && <tr><td colSpan={5}><EmptyState icon={Clock} text="Cargando ventas…" /></td></tr>}
              {!estado.loading && estado.error && <tr><td colSpan={5}><EmptyState icon={AlertTriangle} text={`No se pudieron cargar las ventas: ${estado.error}`} /></td></tr>}
              {!estado.loading && !estado.error && ventas.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon={ShoppingBag} text="Todavía no has registrado ventas de productos." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
