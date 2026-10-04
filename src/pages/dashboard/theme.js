import {
  Clock, CheckCircle2, XCircle,
} from 'lucide-react';

/* =========================================================================
   TOKENS DE DISEÑO
   Paleta "cuero y latón" — negro cálido, cuero oscuro, acento en latón/bronce.
   ========================================================================= */
export const C = {
  bg: '#0F0D0B',
  bgSoft: '#141110',
  surface: '#1B1714',
  surfaceHover: '#221D18',
  border: '#2C2620',
  borderSoft: '#221E19',
  gold: '#C79A5B',
  goldBright: '#E0B679',
  goldDim: '#8A6D45',
  text: '#F3ECE0',
  textMuted: '#A99A87',
  textFaint: '#6E6255',
  green: '#7FA07A',
  greenBg: 'rgba(127,160,122,0.12)',
  amber: '#D0A24E',
  amberBg: 'rgba(208,162,78,0.12)',
  red: '#BD6552',
  redBg: 'rgba(189,101,82,0.12)',
  blue: '#7C97AC',
};

/* -------------------------------------------------------------------------
   Paleta secundaria para Inventario y Ventas Extra.
   Intencionalmente distinta al dorado/cuero del core de cortes: un verde
   azulado "almacén" que ayuda a que el usuario distinga de un vistazo que
   está en una sección de productos/stock y no en la operación de barbería.
   ------------------------------------------------------------------------- */
export const INV = {
  accent: '#5E9788',
  accentBright: '#7DB8A8',
  accentDim: '#3E6459',
  accentBg: 'rgba(94,151,136,0.14)',
  surface: '#12191A',
  border: '#233634',
};

export const fmtCOP = (n) => '$' + Math.round(n).toLocaleString('es-CO');

export const fmtCompact = (n) => n >= 1000000 ? '$' + (n/1000000).toFixed(1).replace('.0','') + 'M' : n >= 1000 ? '$' + Math.round(n/1000) + 'K' : fmtCOP(n);

/* Categorías de servicio disponibles para el formulario de alta/edición */
export const CATEGORIAS_SERVICIO = ['Cortes', 'Barba', 'Combos', 'Tratamientos'];

/* =========================================================================
   MOCK DATA — INVENTARIO (productos ajenos al servicio de corte)
   ========================================================================= */
export const CATEGORIAS_PRODUCTO = ['Styling', 'Cuidado de barba', 'Cuidado capilar', 'Insumos', 'Bebidas'];

/* =========================================================================
   MOCK DATA — VENTAS DE PRODUCTOS (ajenas al servicio de corte)
   ========================================================================= */
export const ESTADOS = {
  Confirmada: { color: C.green, bg: C.greenBg, icon: CheckCircle2 },
  Pendiente: { color: C.amber, bg: C.amberBg, icon: Clock },
  Cancelada: { color: C.red, bg: C.redBg, icon: XCircle },
  Finalizada: { color: C.textMuted, bg: 'rgba(169,154,135,0.1)', icon: CheckCircle2 },
};

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const darkTooltip = { background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text };
