import {
  Clock, CheckCircle2, XCircle,
} from 'lucide-react';

/* =========================================================================
   TOKENS DE DISEÑO — sistema "Turno"
   Lienzo blanco, tinta verde-negra y un único acento (tónico). Cada color
   significa una sola cosa: tónico = acción y confirmado, caléndula = pendiente,
   coral = peligro, índigo = tienda y clientes nuevos.
   ========================================================================= */
export const C = {
  bg: '#FFFFFF',
  bgSoft: '#F3F5F4',
  surface: '#FFFFFF',
  surfaceHover: '#F3F5F4',
  border: '#DCE2E0',
  borderSoft: '#E9EDEB',
  ink: '#12201F',
  accent: '#007A6E',
  accentBright: '#00625A',
  accentDim: '#8ED9CF',
  accentBg: 'rgba(0,122,110,0.10)',
  onAccent: '#FFFFFF',
  text: '#12201F',
  textMuted: '#46544F',
  textFaint: '#66726E',
  green: '#007A6E',
  greenBg: 'rgba(0,122,110,0.10)',
  amber: '#7A4E00',
  amberBg: 'rgba(242,176,30,0.22)',
  amberSolid: '#F2B01E',
  red: '#C62F36',
  redBg: 'rgba(198,47,54,0.09)',
  blue: '#4F46E5',
  blueBg: 'rgba(79,70,229,0.10)',
  scrim: 'rgba(18,32,31,0.5)',
};

/* -------------------------------------------------------------------------
   Tienda (Inventario y Ventas Extra): índigo, distinto al tónico del core
   de cortes, para saber de un vistazo que estás en productos y stock.
   ------------------------------------------------------------------------- */
export const INV = {
  accent: '#4F46E5',
  accentBright: '#3F37C9',
  accentDim: '#B7B3F5',
  accentBg: 'rgba(79,70,229,0.09)',
  surface: '#F6F5FE',
  border: '#DCDAF7',
};

export const DISPLAY_FONT = "'Bricolage Grotesque', 'Instrument Sans', system-ui, sans-serif";

export const fmtCOP = (n) => '$' + Math.round(n).toLocaleString('es-CO');

export const fmtCompact = (n) => n >= 1000000 ? '$' + (n/1000000).toFixed(1).replace('.0','') + 'M' : n >= 1000 ? '$' + Math.round(n/1000) + 'K' : fmtCOP(n);

/* Categorías de servicio disponibles para el formulario de alta/edición */
export const CATEGORIAS_SERVICIO = ['Cortes', 'Barba', 'Combos', 'Tratamientos'];

/* Categorías de producto para inventario y ventas extra */
export const CATEGORIAS_PRODUCTO = ['Styling', 'Cuidado de barba', 'Cuidado capilar', 'Insumos', 'Bebidas'];

/* Estados de cita: color, fondo e icono */
export const ESTADOS = {
  Confirmada: { color: C.green, bg: C.greenBg, icon: CheckCircle2 },
  Pendiente: { color: C.amber, bg: C.amberBg, icon: Clock },
  Cancelada: { color: C.red, bg: C.redBg, icon: XCircle },
  Finalizada: { color: C.textMuted, bg: 'rgba(70,84,79,0.10)', icon: CheckCircle2 },
};

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const tooltipStyle = { background: C.ink, border: 'none', borderRadius: 10, fontSize: 12, color: '#fff', boxShadow: 'none' };
