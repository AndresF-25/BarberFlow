import { useState } from 'react';
import {
  DollarSign, Plus, Clock, AlertTriangle, Flame, ShoppingBag, PackageMinus,
} from 'lucide-react';
import { todayIso } from '../../../api/client';
import { C, INV, fmtCOP, fmtCompact } from '../theme';
import { addDaysIso, fmtFecha } from '../dates';
import { Modal, Field } from '../components/Modal';
import { SectionCard, EmptyState, KpiCard } from '../components/ui';

/* =========================================================================
   VISTA: VENTAS EXTRA (productos ajenos al servicio de corte)
   El dueño ve todas las ventas; un barbero solo las suyas (lo decide el servidor).
   ========================================================================= */
const inputStyle = { background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text };
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none';
const PERIODOS = [
  { id: 'hoy', label: 'Hoy', dias: 1 },
  { id: '7', label: '7 días', dias: 7 },
  { id: '30', label: '30 días', dias: 30 },
  { id: 'todo', label: 'Todo', dias: null },
];

function VentaModal({ productos, onClose, onSave }) {
  const disponibles = productos.filter(p => p.stock > 0);
  const [form, setForm] = useState({ productoId: disponibles[0]?.id || '', cantidad: '1', cliente: '' });
  const productoSel = productos.find(p => p.id === form.productoId);
  const cantidad = Number(form.cantidad);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const validar = () => {
    if (!productoSel) return 'Elige un producto.';
    if (form.cantidad === '' || !Number.isInteger(cantidad) || cantidad < 1) return 'La cantidad debe ser un número entero, desde 1.';
    if (cantidad > productoSel.stock) return `Solo hay ${productoSel.stock} en stock.`;
    if (form.cliente.replace(/\s+/g, ' ').trim().length > 80) return 'El nombre del cliente es demasiado largo (máximo 80 caracteres).';
    return '';
  };

  const guardar = async (e) => {
    e.preventDefault();
    const problema = validar();
    if (problema) return setError(problema);
    setGuardando(true);
    setError('');
    const result = await onSave({
      productId: productoSel.id,
      quantity: cantidad,
      ...(form.cliente.trim() ? { clientName: form.cliente.trim() } : {}),
    });
    setGuardando(false);
    if (result?.ok) onClose();
    else setError(result?.error || 'No se pudo registrar la venta.');
  };

  const total = Number.isInteger(cantidad) && cantidad > 0 ? (productoSel?.precioVenta || 0) * cantidad : 0;

  return (
    <Modal title="Registrar venta" tone="tienda" onClose={onClose} showClose>
      {disponibles.length === 0 ? (
        <>
          <EmptyState icon={PackageMinus} text="No hay productos con stock disponible." />
          <button type="button" onClick={onClose} className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Volver</button>
        </>
      ) : (
        <form onSubmit={guardar} noValidate>
          <div className="space-y-3">
            <Field label="Producto">
              <select value={form.productoId} onChange={e => setForm({ ...form, productoId: e.target.value, cantidad: '1' })} className={inputClass} style={inputStyle}>
                {disponibles.map(p => <option key={p.id} value={p.id}>{p.nombre} — {fmtCOP(p.precioVenta)} ({p.stock} disp.)</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad">
                <input type="number" inputMode="numeric" min="1" max={productoSel?.stock} step="1" value={form.cantidad}
                  onChange={e => setForm({ ...form, cantidad: e.target.value })} className={inputClass} style={inputStyle} />
              </Field>
              <div>
                <span className="text-xs block" style={{ color: C.textMuted }}>Total</span>
                <output aria-label="Total de la venta" className="block w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: INV.accentBright }}>
                  {fmtCOP(total)}
                </output>
              </div>
            </div>
            <Field label="Cliente (opcional)">
              <input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} className={inputClass} style={inputStyle} placeholder="Ej. Sebastián Gómez" autoComplete="off" />
            </Field>
          </div>
          {error && <p role="alert" className="text-xs mt-4" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
            <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5" style={{ background: INV.accent, color: '#fff' }}>
              <ShoppingBag size={14} aria-hidden="true" /> {guardando ? 'Registrando…' : 'Registrar venta'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function VentasView({ productos, ventas, estado = { loading: false, error: '' }, onAddVenta, esOwner = true }) {
  const [modal, setModal] = useState(false);
  const [periodo, setPeriodo] = useState('30');

  const dias = PERIODOS.find(p => p.id === periodo).dias;
  const desde = dias ? addDaysIso(todayIso(), -(dias - 1)) : null;
  const visibles = desde ? ventas.filter(v => v.fecha >= desde) : ventas;

  const totalVentas = visibles.reduce((a, v) => a + v.total, 0);
  const unidadesVendidas = visibles.reduce((a, v) => a + v.cantidad, 0);
  const productoTop = visibles.length
    ? Object.entries(visibles.reduce((acc, v) => { acc[v.producto] = (acc[v.producto] || 0) + v.cantidad; return acc; }, {}))
        .sort((a, b) => b[1] - a[1])[0][0]
    : '—';
  const etiquetaPeriodo = periodo === 'todo' ? 'todo el historial' : periodo === 'hoy' ? 'hoy' : `los últimos ${dias} días`;

  return (
    <div className="space-y-5 bd-fade-in">
      {modal && <VentaModal productos={productos} onClose={() => setModal(false)} onSave={onAddVenta} />}

      <SectionCard>
        <div className="flex items-center gap-3">
          <ShoppingBag size={16} style={{ color: INV.accentBright }} aria-hidden="true" />
          <div className="text-xs" style={{ color: C.textMuted }}>
            Ventas de productos que no son parte del servicio de corte — gel, cera, cerveza, y demás. Cada venta descuenta el stock automáticamente en Inventario. Si indicas un cliente, queda en su historial.
            {!esOwner && ' Aquí ves solo las ventas que registraste tú.'}
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Período">
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => setPeriodo(p.id)} aria-pressed={periodo === p.id} className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: periodo === p.id ? INV.accentBg : 'transparent', color: periodo === p.id ? INV.accentBright : C.textFaint, border: `1px solid ${periodo === p.id ? INV.accent + '66' : INV.border}` }}>{p.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign} label="Ingresos por ventas extra" value={fmtCompact(totalVentas)} sub={`En ${etiquetaPeriodo}`} tienda />
        <KpiCard icon={ShoppingBag} label="Unidades vendidas" value={unidadesVendidas} sub={`En ${etiquetaPeriodo}`} tienda />
        <KpiCard icon={Flame} label="Producto más vendido" value={productoTop} sub={`En ${etiquetaPeriodo}`} tienda />
      </div>

      <div className="pt-5" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="bd-display text-xl leading-tight">Historial de ventas</h3>
          <button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: INV.accent, color: '#fff' }}>
            <Plus size={14} aria-hidden="true" /> Registrar venta
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
                {esOwner && <th className="pb-3 font-medium hidden md:table-cell">Vendió</th>}
                <th className="pb-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(v => (
                <tr key={v.id} className="bd-row" style={{ borderTop: `1px solid ${INV.border}` }}>
                  <td className="py-3 whitespace-nowrap" style={{ color: C.textMuted }}>{fmtFecha(v.fecha)}{v.hora && <span className="text-xs ml-1.5" style={{ color: C.textFaint }}>{v.hora}</span>}</td>
                  <td className="py-3 font-medium">{v.producto}</td>
                  <td className="py-3" style={{ color: C.textMuted }}>{v.cantidad}</td>
                  <td className="py-3 hidden sm:table-cell" style={{ color: C.textMuted }}>{v.cliente || '—'}</td>
                  {esOwner && <td className="py-3 hidden md:table-cell" style={{ color: C.textMuted }}>{v.vendedor || '—'}</td>}
                  <td className="py-3 font-medium" style={{ color: INV.accentBright }}>{fmtCOP(v.total)}</td>
                </tr>
              ))}
              {estado.loading && <tr><td colSpan={6}><EmptyState icon={Clock} text="Cargando ventas…" /></td></tr>}
              {!estado.loading && estado.error && <tr><td colSpan={6}><EmptyState icon={AlertTriangle} text={`No se pudieron cargar las ventas: ${estado.error}`} /></td></tr>}
              {!estado.loading && !estado.error && visibles.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={ShoppingBag} text={ventas.length === 0 ? 'Todavía no has registrado ventas de productos.' : `No hay ventas en ${etiquetaPeriodo}. Prueba con «Todo».`} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
