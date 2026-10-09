import { useEffect, useRef, useState } from 'react';
import {
  DollarSign, Clock, AlertTriangle, Pencil, Trash2, Package, PackagePlus, Boxes, AlertOctagon, Save, ArrowDownUp, Info, History,
} from 'lucide-react';
import { C, INV, fmtCOP, fmtCompact, CATEGORIAS_PRODUCTO } from '../theme';
import { Modal, Field } from '../components/Modal';
import { SectionCard, EmptyState, KpiCard } from '../components/ui';

/* =========================================================================
   VISTA: INVENTARIO
   Sección "tienda", ajena al servicio de corte — usa la paleta INV para distinguirse del resto del panel.
   Las reglas de validación replican las del servidor (routes/products.js); el servidor es quien decide.
   ========================================================================= */
const MAX_STOCK = 1000000;
const MAX_PRECIO = 10000000;
const inputStyle = { background: C.bgSoft, border: `1px solid ${INV.border}`, color: C.text };
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none';
const UNIDADES = [['unidad', 'Unidad'], ['paquete', 'Paquete'], ['ml', 'Mililitros']];

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** «1 unidad», «5 unidades», «2 paquetes», «250 ml». */
export function fmtStock(n, unidad) {
  if (unidad === 'unidad') return plural(n, 'unidad', 'unidades');
  if (unidad === 'paquete') return plural(n, 'paquete', 'paquetes');
  return `${n} ${unidad}`;
}

function validar(f) {
  const nombre = f.nombre.trim();
  const entero = (v) => v !== '' && Number.isInteger(Number(v));
  if (!nombre) return 'Ingresa el nombre del producto.';
  if (nombre.length > 80) return 'El nombre del producto es demasiado largo (máximo 80 caracteres).';
  if (!entero(f.stock) || Number(f.stock) < 0) return 'El stock debe ser un número entero, desde 0.';
  if (Number(f.stock) > MAX_STOCK) return 'El stock es demasiado alto (máximo 1.000.000).';
  if (!entero(f.stockMinimo) || Number(f.stockMinimo) < 0) return 'El stock mínimo debe ser un número entero, desde 0.';
  if (Number(f.stockMinimo) > MAX_STOCK) return 'El stock mínimo es demasiado alto (máximo 1.000.000).';
  if (!entero(f.precioVenta) || Number(f.precioVenta) <= 0) return 'El precio de venta debe ser un número entero de pesos, mayor que cero.';
  if (Number(f.precioVenta) > MAX_PRECIO) return 'El precio de venta es demasiado alto (máximo $10.000.000).';
  if (f.precioCosto !== '' && (!entero(f.precioCosto) || Number(f.precioCosto) < 0)) return 'El precio de costo debe ser un número entero de pesos.';
  if (Number(f.precioCosto) > MAX_PRECIO) return 'El precio de costo es demasiado alto (máximo $10.000.000).';
  return '';
}

function ProductoModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial
    ? { nombre: initial.nombre, categoria: initial.categoria, stock: String(initial.stock), stockMinimo: String(initial.stockMinimo), unidad: initial.unidad, precioVenta: String(initial.precioVenta), precioCosto: String(initial.precioCosto ?? '') }
    : { nombre: '', categoria: CATEGORIAS_PRODUCTO[0], stock: '', stockMinimo: '', unidad: 'unidad', precioVenta: '', precioCosto: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const esEdicion = !!initial;
  // Un producto con una categoría o unidad fuera de las listas conserva la suya en vez de saltar a la primera opción.
  const categorias = CATEGORIAS_PRODUCTO.includes(form.categoria) ? CATEGORIAS_PRODUCTO : [...CATEGORIAS_PRODUCTO, form.categoria];
  const unidades = UNIDADES.some(([v]) => v === form.unidad) ? UNIDADES : [...UNIDADES, [form.unidad, form.unidad]];
  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    const problema = validar(form);
    if (problema) return setError(problema);
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
    <Modal title={esEdicion ? 'Editar producto' : 'Nuevo producto'} tone="tienda" onClose={onClose} showClose>
      <form onSubmit={guardar} noValidate>
        <div className="space-y-3">
          <Field label="Nombre del producto">
            <input value={form.nombre} onChange={set('nombre')} className={inputClass} style={inputStyle} placeholder="Ej. Cera mate" autoComplete="off" />
          </Field>
          <Field label="Categoría">
            <select value={form.categoria} onChange={set('categoria')} className={inputClass} style={inputStyle}>
              {categorias.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock actual">
              <input type="number" inputMode="numeric" min="0" max={MAX_STOCK} step="1" value={form.stock} onChange={set('stock')} className={inputClass} style={inputStyle} placeholder="10" />
            </Field>
            <Field label="Stock mínimo">
              <input type="number" inputMode="numeric" min="0" max={MAX_STOCK} step="1" value={form.stockMinimo} onChange={set('stockMinimo')} className={inputClass} style={inputStyle} placeholder="5" />
            </Field>
          </div>
          {esEdicion && <p className="text-xs -mt-1" style={{ color: C.textFaint }}>Si cambias el stock aquí, queda registrado como una corrección. Para una entrada o salida de mercancía usa «Ajustar stock».</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio de venta">
              <input type="number" inputMode="numeric" min="0" max={MAX_PRECIO} step="1" value={form.precioVenta} onChange={set('precioVenta')} className={inputClass} style={inputStyle} placeholder="28000" />
            </Field>
            <Field label="Precio de costo">
              <input type="number" inputMode="numeric" min="0" max={MAX_PRECIO} step="1" value={form.precioCosto} onChange={set('precioCosto')} className={inputClass} style={inputStyle} placeholder="15000" />
            </Field>
          </div>
          <Field label="Unidad">
            <select value={form.unidad} onChange={set('unidad')} className={inputClass} style={inputStyle}>
              {unidades.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Field>
        </div>
        {error && <p role="alert" className="text-xs mt-4" style={{ color: C.red }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
          <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5" style={{ background: INV.accent, color: '#fff' }}>
            <Save size={14} aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Entrada o salida de mercancía: queda en el historial de stock con la razón «manual». */
function AjusteModal({ producto, onClose, onSave }) {
  const [sentido, setSentido] = useState('entrada');
  const [cantidad, setCantidad] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const n = Number(cantidad);
  const valida = cantidad !== '' && Number.isInteger(n) && n > 0 && n <= MAX_STOCK;
  const delta = sentido === 'entrada' ? n : -n;
  const quedara = valida ? Math.max(0, producto.stock + delta) : null;

  const guardar = async (e) => {
    e.preventDefault();
    if (!valida) return setError('La cantidad debe ser un número entero mayor que cero.');
    if (quedara > MAX_STOCK) return setError('El stock no puede pasar de 1.000.000.');
    setGuardando(true);
    setError('');
    const result = await onSave(producto.id, delta);
    setGuardando(false);
    if (result?.ok) onClose();
    else setError(result?.error || 'No se pudo ajustar el stock.');
  };

  const opcion = (valor, texto) => (
    <button type="button" role="radio" aria-checked={sentido === valor} onClick={() => setSentido(valor)}
      className="flex-1 py-2 rounded-lg text-sm font-medium"
      style={{ background: sentido === valor ? INV.accent : 'transparent', color: sentido === valor ? '#fff' : C.textMuted, border: `1px solid ${sentido === valor ? INV.accent : INV.border}` }}>
      {texto}
    </button>
  );

  return (
    <Modal title={`Ajustar stock de ${producto.nombre}`} size="sm" tone="tienda" onClose={onClose}>
      <form onSubmit={guardar} noValidate>
        <p className="text-xs mb-4" style={{ color: C.textMuted }}>Ahora hay {fmtStock(producto.stock, producto.unidad)}.</p>
        <div role="radiogroup" aria-label="Tipo de ajuste" className="flex gap-2 mb-3">
          {opcion('entrada', 'Entra mercancía')}
          {opcion('salida', 'Sale mercancía')}
        </div>
        <Field label="Cantidad">
          <input type="number" inputMode="numeric" min="1" max={MAX_STOCK} step="1" value={cantidad} onChange={e => setCantidad(e.target.value)} className={inputClass} style={inputStyle} placeholder="Ej. 12" />
        </Field>
        {valida && (
          <p className="text-xs mt-2 flex items-start gap-1.5" style={{ color: sentido === 'salida' && producto.stock + delta < 0 ? C.red : C.textMuted }}>
            <Info size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            {sentido === 'salida' && producto.stock + delta < 0
              ? `Solo hay ${producto.stock}: el stock quedará en 0.`
              : `Quedará en ${fmtStock(quedara, producto.unidad)}.`}
          </p>
        )}
        {error && <p role="alert" className="text-xs mt-3" style={{ color: C.red }}>{error}</p>}
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
          <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: INV.accent, color: '#fff' }}>{guardando ? 'Guardando…' : 'Ajustar stock'}</button>
        </div>
      </form>
    </Modal>
  );
}

const fmtMovimiento = (m) => {
  if (m.motivo === 'venta') return 'Venta';
  if (m.motivo === 'correccion') return 'Corrección';
  return m.cambio > 0 ? 'Entrada de mercancía' : 'Salida de mercancía';
};

const fmtFechaHora = (iso) => {
  const f = new Date(iso);
  const año = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', year: 'numeric' }).format(f);
  const actual = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', year: 'numeric' }).format(new Date());
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'short', ...(año !== actual ? { year: 'numeric' } : {}), hour: 'numeric', minute: '2-digit',
  }).format(f);
};

/** Cada entrada y salida del producto, de la más reciente a la más antigua, con el stock que quedó. */
function HistorialModal({ producto, onClose, onLoad }) {
  const [estado, setEstado] = useState({ loading: true, error: '', movements: [], total: 0 });
  const onLoadRef = useRef(onLoad); // el hook crea la función de nuevo en cada render: no debe relanzar la carga
  onLoadRef.current = onLoad;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await onLoadRef.current(producto.id);
      if (cancelado) return;
      setEstado(r.ok
        ? { loading: false, error: '', movements: r.movements || [], total: r.total || 0 }
        : { loading: false, error: r.error || 'No se pudo cargar el historial.', movements: [], total: 0 });
    })();
    return () => { cancelado = true; };
  }, [producto.id]);

  return (
    <Modal title={`Historial de stock de ${producto.nombre}`} tone="tienda" onClose={onClose} showClose>
      {estado.loading && <p role="status" className="text-sm py-6 text-center" style={{ color: C.textMuted }}>Cargando historial…</p>}
      {!estado.loading && estado.error && <p role="alert" className="text-sm py-4" style={{ color: C.red }}>{estado.error}</p>}
      {!estado.loading && !estado.error && estado.movements.length === 0 && (
        <p className="text-sm py-6 text-center" style={{ color: C.textMuted }}>Este producto todavía no tiene movimientos.</p>
      )}
      {!estado.loading && !estado.error && estado.movements.length > 0 && (
        <>
          <div className="max-h-[22rem] overflow-y-auto bd-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: C.textFaint }}>
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Movimiento</th>
                  <th className="pb-2 font-medium text-right">Cambio</th>
                  <th className="pb-2 font-medium text-right">Quedó</th>
                </tr>
              </thead>
              <tbody>
                {estado.movements.map(m => (
                  <tr key={m.id} style={{ borderTop: `1px solid ${INV.border}` }}>
                    <td className="py-2 text-xs whitespace-nowrap" style={{ color: C.textMuted }}>{fmtFechaHora(m.fecha)}</td>
                    <td className="py-2">{fmtMovimiento(m)}</td>
                    <td className="py-2 text-right font-medium" style={{ color: m.cambio > 0 ? INV.accentBright : C.red }}>{m.cambio > 0 ? `+${m.cambio}` : m.cambio}</td>
                    <td className="py-2 text-right" style={{ color: C.textMuted }}>{m.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {estado.total > estado.movements.length && (
            <p className="text-xs mt-3" style={{ color: C.textFaint }}>Mostrando los últimos {estado.movements.length} de {estado.total} movimientos.</p>
          )}
        </>
      )}
    </Modal>
  );
}

export function InventarioView({ productos, estado = { loading: false, error: '' }, onAdd, onEdit, onDelete, onAdjust, onHistory }) {
  const [modal, setModal] = useState(null); // null | 'new' | producto
  const [ajuste, setAjuste] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [errorBorrar, setErrorBorrar] = useState('');
  const [aviso, setAviso] = useState('');
  const [categoria, setCategoria] = useState('Todas');

  const eliminar = async () => {
    const borrado = confirmarBorrar;
    const result = await onDelete(borrado.id);
    if (result?.ok) {
      setConfirmarBorrar(null);
      setErrorBorrar('');
      setAviso(`«${borrado.nombre}» salió del inventario. Sus ventas anteriores se conservan.`);
    } else setErrorBorrar(result?.error || 'No se pudo eliminar el producto.');
  };

  const bajoStock = productos.filter(p => p.stock <= p.stockMinimo);
  const valorInventario = productos.reduce((a, p) => a + p.stock * (p.precioCosto || 0), 0);
  // Las categorías que existan en los datos aparecen aunque no estén en la lista base.
  const categorias = ['Todas', ...CATEGORIAS_PRODUCTO, ...new Set(productos.map(p => p.categoria).filter(c => !CATEGORIAS_PRODUCTO.includes(c)))];
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
      {ajuste && <AjusteModal producto={ajuste} onClose={() => setAjuste(null)} onSave={onAdjust} />}
      {historial && <HistorialModal producto={historial} onClose={() => setHistorial(null)} onLoad={onHistory} />}

      {aviso && (
        <div role="status" className="flex items-start gap-2.5 text-sm p-3.5 rounded-lg" style={{ background: INV.accentBg, color: C.text }}>
          <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: INV.accent }} aria-hidden="true" />
          <span className="flex-1">{aviso}</span>
          <button onClick={() => setAviso('')} className="text-xs font-medium" style={{ color: C.textMuted }}>Entendido</button>
        </div>
      )}

      <SectionCard>
        <div className="flex items-center gap-3">
          <Boxes size={16} style={{ color: INV.accentBright }} aria-hidden="true" />
          <div className="text-xs" style={{ color: C.textMuted }}>
            Productos a la venta ajenos al servicio de corte — styling, cuidado de barba, bebidas e insumos. Se muestran en su propia sección para diferenciarlos del core de la barbería.
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Package} label="Productos en catálogo" value={productos.length} tienda />
        <KpiCard icon={AlertOctagon} label="Productos con stock bajo" value={bajoStock.length} tienda alerta={bajoStock.length > 0} />
        <KpiCard icon={DollarSign} label="Valor de inventario (costo)" value={fmtCompact(valorInventario)} tienda />
      </div>

      {bajoStock.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: C.redBg, border: `1px solid ${C.red}44` }}>
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: C.red }}>
            <AlertTriangle size={14} aria-hidden="true" /> Stock bajo en {plural(bajoStock.length, 'producto', 'productos')}: {bajoStock.map(p => p.nombre).join(', ')}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtrar por categoría">
        {categorias.map(c => (
          <button key={c} onClick={() => setCategoria(c)} aria-pressed={categoria === c} className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: categoria === c ? INV.accentBg : 'transparent', color: categoria === c ? INV.accentBright : C.textFaint, border: `1px solid ${categoria === c ? INV.accent + '66' : INV.border}` }}>{c}</button>
        ))}
      </div>

      <div className="pt-5" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="bd-display text-xl leading-tight">Catálogo de inventario</h3>
          <button onClick={() => setModal('new')} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: INV.accent, color: '#fff' }}>
            <PackagePlus size={14} aria-hidden="true" /> Nuevo producto
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
                <th className="pb-3 font-medium"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const bajo = p.stock <= p.stockMinimo;
                const margen = p.precioVenta > 0 ? ((p.precioVenta - (p.precioCosto || 0)) / p.precioVenta) * 100 : 0;
                return (
                  <tr key={p.id} className="bd-row" style={{ borderTop: `1px solid ${INV.border}` }}>
                    <td className="py-3 font-medium">{p.nombre}</td>
                    <td className="py-3 hidden sm:table-cell" style={{ color: C.textMuted }}>{p.categoria}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: bajo ? C.red : INV.accentBright, background: bajo ? C.redBg : INV.accentBg }}>
                        {p.stock === 0 ? 'Agotado' : fmtStock(p.stock, p.unidad)}
                      </span>
                    </td>
                    <td className="py-3 hidden md:table-cell" style={{ color: C.textMuted }}>{fmtCOP(p.precioVenta)}</td>
                    <td className="py-3 hidden lg:table-cell" style={{ color: C.textMuted }}>{margen.toFixed(0)}%</td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {onHistory && (
                        <button onClick={() => setHistorial(p)} className="w-7 h-7 rounded-md inline-flex items-center justify-center mr-1" style={{ border: `1px solid ${INV.border}` }} title="Historial de stock" aria-label={`Historial de stock de ${p.nombre}`}>
                          <History size={12} style={{ color: C.textMuted }} aria-hidden="true" />
                        </button>
                      )}
                      <button onClick={() => setAjuste(p)} className="w-7 h-7 rounded-md inline-flex items-center justify-center mr-1" style={{ border: `1px solid ${INV.border}` }} title="Ajustar stock" aria-label={`Ajustar stock de ${p.nombre}`}>
                        <ArrowDownUp size={12} style={{ color: C.textMuted }} aria-hidden="true" />
                      </button>
                      <button onClick={() => setModal(p)} className="w-7 h-7 rounded-md inline-flex items-center justify-center mr-1" style={{ border: `1px solid ${INV.border}` }} title="Editar" aria-label={`Editar ${p.nombre}`}>
                        <Pencil size={12} style={{ color: C.textMuted }} aria-hidden="true" />
                      </button>
                      <button onClick={() => { setErrorBorrar(''); setConfirmarBorrar(p); }} className="w-7 h-7 rounded-md inline-flex items-center justify-center" style={{ border: `1px solid ${INV.border}` }} title="Eliminar" aria-label={`Eliminar ${p.nombre}`}>
                        <Trash2 size={12} style={{ color: C.red }} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {estado.loading && <tr><td colSpan={6}><EmptyState icon={Clock} text="Cargando inventario…" /></td></tr>}
              {!estado.loading && estado.error && <tr><td colSpan={6}><EmptyState icon={AlertTriangle} text={`No se pudo cargar el inventario: ${estado.error}`} /></td></tr>}
              {!estado.loading && !estado.error && filtrados.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={Package} text={productos.length === 0 ? 'Todavía no tienes productos. Crea el primero con «Nuevo producto».' : 'No hay productos en esta categoría.'} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmarBorrar && (
        <Modal title="¿Eliminar producto?" size="sm" tone="tienda" onClose={() => { setConfirmarBorrar(null); setErrorBorrar(''); }}>
          <p className="text-xs mb-5" style={{ color: C.textMuted }}>Vas a eliminar <strong style={{ color: C.text }}>{confirmarBorrar.nombre}</strong> del inventario. Las ventas ya registradas se conservan.</p>
          {errorBorrar && <p role="alert" className="text-xs mb-4" style={{ color: C.red }}>{errorBorrar}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setConfirmarBorrar(null); setErrorBorrar(''); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
            <button onClick={eliminar} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.red, color: '#fff' }}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
