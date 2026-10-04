import { useState } from 'react';
import {
  DollarSign, X, Clock, AlertTriangle, Pencil, Trash2, Package, PackagePlus, Boxes, AlertOctagon, Save,
} from 'lucide-react';
import { C, INV, fmtCOP, fmtCompact, CATEGORIAS_PRODUCTO } from '../theme';
import { SectionCard, EmptyState } from '../components/ui';

/* =========================================================================
   VISTA: INVENTARIO
   Sección "tienda", ajena al servicio de corte — usa la paleta INV para
   distinguirse visualmente del resto del panel (dorado/cuero de barbería).
   ========================================================================= */
function ProductoModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { nombre: '', categoria: CATEGORIAS_PRODUCTO[0], stock: '', stockMinimo: '', unidad: 'unidad', precioVenta: '', precioCosto: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const esEdicion = !!initial;
  const puedeGuardar = !guardando && form.nombre.trim().length > 1 && Number(form.precioVenta) > 0 && form.stock !== '' && form.stockMinimo !== '';

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const result = await onSave({
      nombre: form.nombre.trim(), categoria: form.categoria, unidad: form.unidad,
      stock: Number(form.stock), stockMinimo: Number(form.stockMinimo),
      precioVenta: Number(form.precioVenta), precioCosto: Number(form.precioCosto) || 0,
    });
    setGuardando(false);
    if (result?.ok) onClose();
    else setError(result?.error || 'No se pudo guardar el producto.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 bd-fade-in" style={{ background: INV.surface, border: `1px solid ${INV.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="bd-display text-base font-semibold">{esEdicion ? 'Editar producto' : 'Nuevo producto'}</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Nombre del producto</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }} placeholder="Ej. Cera mate" />
          </div>
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Categoría</label>
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }}>
              {CATEGORIAS_PRODUCTO.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Stock actual</label>
              <input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }} placeholder="10" />
            </div>
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Stock mínimo</label>
              <input type="number" min="0" value={form.stockMinimo} onChange={e => setForm({ ...form, stockMinimo: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }} placeholder="5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Precio de venta</label>
              <input type="number" min="0" value={form.precioVenta} onChange={e => setForm({ ...form, precioVenta: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }} placeholder="28000" />
            </div>
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Precio de costo</label>
              <input type="number" min="0" value={form.precioCosto} onChange={e => setForm({ ...form, precioCosto: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }} placeholder="15000" />
            </div>
          </div>
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Unidad</label>
            <select value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text }}>
              <option value="unidad">Unidad</option>
              <option value="paquete">Paquete</option>
              <option value="ml">Mililitros</option>
            </select>
          </div>
        </div>
        {error && <p className="text-xs mt-4" style={{ color: C.red }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
          <button
            disabled={!puedeGuardar}
            onClick={guardar}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ background: puedeGuardar ? INV.accent : C.borderSoft, color: puedeGuardar ? '#fff' : C.textFaint }}>
            <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InventarioView({ productos, estado = { loading: false, error: '' }, onAdd, onEdit, onDelete }) {
  const [modal, setModal] = useState(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [errorBorrar, setErrorBorrar] = useState('');

  const eliminar = async () => {
    const result = await onDelete(confirmarBorrar.id);
    if (result?.ok) { setConfirmarBorrar(null); setErrorBorrar(''); }
    else setErrorBorrar(result?.error || 'No se pudo eliminar el producto.');
  };
  const [categoria, setCategoria] = useState('Todas');

  const bajoStock = productos.filter(p => p.stock <= p.stockMinimo);
  const valorInventario = productos.reduce((a, p) => a + p.stock * p.precioCosto, 0);
  const categorias = ['Todas', ...CATEGORIAS_PRODUCTO];
  const filtrados = categoria === 'Todas' ? productos : productos.filter(p => p.categoria === categoria);

  return (
    <div className="space-y-5 bd-fade-in">
      {modal && (
        <ProductoModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={(data) => modal === 'new' ? onAdd(data) : onEdit(modal.id, data)}
        />
      )}

      <SectionCard>
        <div className="flex items-center gap-3">
          <Boxes size={16} style={{ color: INV.accentBright }} />
          <div className="text-xs" style={{ color: C.textMuted }}>
            Productos a la venta ajenos al servicio de corte — styling, cuidado de barba, bebidas e insumos. Se muestran en su propia sección para diferenciarlos del core de la barbería.
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bd-card bd-fade-in p-5 rounded-xl relative overflow-hidden" style={{ background: INV.surface, border: `1px solid ${INV.border}` }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: INV.accentBg }}>
            <Package size={18} style={{ color: INV.accentBright }} />
          </div>
          <div className="bd-display text-2xl font-semibold leading-none mb-1.5">{productos.length}</div>
          <div className="text-xs" style={{ color: C.textMuted }}>Productos en catálogo</div>
        </div>
        <div className="bd-card bd-fade-in p-5 rounded-xl relative overflow-hidden" style={{ background: INV.surface, border: `1px solid ${INV.border}` }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: bajoStock.length ? C.redBg : INV.accentBg }}>
            <AlertOctagon size={18} style={{ color: bajoStock.length ? C.red : INV.accentBright }} />
          </div>
          <div className="bd-display text-2xl font-semibold leading-none mb-1.5">{bajoStock.length}</div>
          <div className="text-xs" style={{ color: C.textMuted }}>Productos con stock bajo</div>
        </div>
        <div className="bd-card bd-fade-in p-5 rounded-xl relative overflow-hidden" style={{ background: INV.surface, border: `1px solid ${INV.border}` }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: INV.accentBg }}>
            <DollarSign size={18} style={{ color: INV.accentBright }} />
          </div>
          <div className="bd-display text-2xl font-semibold leading-none mb-1.5">{fmtCompact(valorInventario)}</div>
          <div className="text-xs" style={{ color: C.textMuted }}>Valor de inventario (costo)</div>
        </div>
      </div>

      {bajoStock.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: C.redBg, border: `1px solid ${C.red}44` }}>
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: C.red }}>
            <AlertTriangle size={14} /> Stock bajo en {bajoStock.length} producto{bajoStock.length > 1 ? 's' : ''}: {bajoStock.map(p => p.nombre).join(', ')}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {categorias.map(c => (
          <button key={c} onClick={() => setCategoria(c)} className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: categoria === c ? INV.accentBg : 'transparent', color: categoria === c ? INV.accentBright : C.textFaint, border: `1px solid ${categoria === c ? INV.accent + '66' : INV.border}` }}>{c}</button>
        ))}
      </div>

      <div className="rounded-xl p-5" style={{ background: INV.surface, border: `1px solid ${INV.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="bd-display text-sm font-semibold tracking-wide">Catálogo de inventario</h3>
          <button onClick={() => setModal('new')} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: INV.accent, color: '#fff' }}>
            <PackagePlus size={14} /> Nuevo producto
          </button>
        </div>
        <div className="overflow-x-auto bd-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: C.textFaint }}>
                <th className="pb-3 font-medium">Producto</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Categoría</th>
                <th className="pb-3 font-medium">Stock</th>
                <th className="pb-3 font-medium hidden md:table-cell">Precio venta</th>
                <th className="pb-3 font-medium hidden lg:table-cell">Margen</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const bajo = p.stock <= p.stockMinimo;
                const margen = p.precioVenta > 0 ? ((p.precioVenta - p.precioCosto) / p.precioVenta) * 100 : 0;
                return (
                  <tr key={p.id} className="bd-row" style={{ borderTop: `1px solid ${INV.border}` }}>
                    <td className="py-3 font-medium">{p.nombre}</td>
                    <td className="py-3 hidden sm:table-cell" style={{ color: C.textMuted }}>{p.categoria}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: bajo ? C.red : INV.accentBright, background: bajo ? C.redBg : INV.accentBg }}>
                        {p.stock} {p.unidad}{p.stock === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="py-3 hidden md:table-cell" style={{ color: C.textMuted }}>{fmtCOP(p.precioVenta)}</td>
                    <td className="py-3 hidden lg:table-cell" style={{ color: C.textMuted }}>{margen.toFixed(0)}%</td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button onClick={() => setModal(p)} className="w-7 h-7 rounded-md inline-flex items-center justify-center mr-1" style={{ border: `1px solid ${INV.border}` }} title="Editar">
                        <Pencil size={12} style={{ color: C.textMuted }} />
                      </button>
                      <button onClick={() => setConfirmarBorrar(p)} className="w-7 h-7 rounded-md inline-flex items-center justify-center" style={{ border: `1px solid ${INV.border}` }} title="Eliminar">
                        <Trash2 size={12} style={{ color: C.red }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {estado.loading && <tr><td colSpan={6}><EmptyState icon={Clock} text="Cargando inventario…" /></td></tr>}
              {!estado.loading && estado.error && <tr><td colSpan={6}><EmptyState icon={AlertTriangle} text={`No se pudo cargar el inventario: ${estado.error}`} /></td></tr>}
              {!estado.loading && !estado.error && filtrados.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={Package} text={productos.length === 0 ? 'Todavía no tienes productos. Crea el primero con "Nuevo producto".' : 'No hay productos en esta categoría.'} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmarBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => { setConfirmarBorrar(null); setErrorBorrar(''); }}>
          <div className="w-full max-w-sm rounded-xl p-6 bd-fade-in" style={{ background: INV.surface, border: `1px solid ${INV.border}` }} onClick={e => e.stopPropagation()}>
            <h3 className="bd-display text-base font-semibold mb-2">¿Eliminar producto?</h3>
            <p className="text-xs mb-5" style={{ color: C.textMuted }}>Vas a eliminar <strong style={{ color: C.text }}>{confirmarBorrar.nombre}</strong> del inventario. Las ventas ya registradas se conservan.</p>
            {errorBorrar && <p className="text-xs mb-4" style={{ color: C.red }}>{errorBorrar}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setConfirmarBorrar(null); setErrorBorrar(''); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
              <button onClick={eliminar} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.red, color: '#fff' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
