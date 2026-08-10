/**
 * NOTA DE INTEGRACIÓN
 * --------------------
 * Este archivo es el Dashboard administrativo generado previamente para
 * BarberFlow. Se incluye aquí como PLACEHOLDER para dejar la ruta /dashboard
 * funcionando de punta a punta (Landing → Registro → Login → Dashboard).
 *
 * Si ya tenés tu propio Dashboard funcionando en otro proyecto/carpeta:
 *   1. Copiá esos archivos dentro de src/pages/dashboard/ (o la carpeta que
 *      prefieras) en lugar de este archivo.
 *   2. Actualizá el import en src/App.jsx: cambiá
 *      `import Dashboard from './pages/dashboard/Dashboard';`
 *      por la ruta a tu componente real.
 *   3. No hace falta tocar App.jsx, ProtectedRoute ni AuthContext: ambos
 *      son independientes del contenido del Dashboard.
 */
import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, CalendarDays, Users, Scissors, DollarSign, TrendingUp, TrendingDown,
  Bell, Menu, X, Search, Plus, ChevronLeft, ChevronRight, Clock, Phone, Star,
  AlertTriangle, CheckCircle2, XCircle, Filter, ArrowUpRight, ArrowDownRight, Award,
  UserPlus, UserCheck, Sparkles, Send, Pencil, Trash2, CreditCard, Wallet, Smartphone,
  Activity, Flame, Gift, Zap, CalendarClock, CalendarX, MessageCircle, ChevronDown, LogOut,
  Package, ShoppingBag, PackageMinus, PackagePlus, Boxes, AlertOctagon, Beer, Save
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, RadialBarChart, RadialBar
} from 'recharts';

/* =========================================================================
   TOKENS DE DISEÑO
   Paleta "cuero y latón" — negro cálido, cuero oscuro, acento en latón/bronce.
   ========================================================================= */
const C = {
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
const INV = {
  accent: '#5E9788',
  accentBright: '#7DB8A8',
  accentDim: '#3E6459',
  accentBg: 'rgba(94,151,136,0.14)',
  surface: '#12191A',
  border: '#233634',
};

const fmtCOP = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const fmtCompact = (n) => n >= 1000000 ? '$' + (n/1000000).toFixed(1).replace('.0','') + 'M' : n >= 1000 ? '$' + Math.round(n/1000) + 'K' : fmtCOP(n);

/* =========================================================================
   MOCK DATA
   ========================================================================= */
const BARBEROS = [
  { id: 'b1', nombre: 'Carlos Ramírez', especialidad: 'Fades & diseño', color: C.gold },
  { id: 'b2', nombre: 'Andrés Torres', especialidad: 'Barba clásica', color: C.blue },
  { id: 'b3', nombre: 'Julián Peña', especialidad: 'Cortes clásicos', color: C.green },
];

const SERVICIOS_INICIAL = [
  { id: 's1', nombre: 'Corte Clásico', categoria: 'Cortes', precio: 35000, duracion: 30, veces: 142 },
  { id: 's2', nombre: 'Corte Moderno (Fade)', categoria: 'Cortes', precio: 42000, duracion: 40, veces: 118 },
  { id: 's3', nombre: 'Arreglo de Barba', categoria: 'Barba', precio: 25000, duracion: 20, veces: 96 },
  { id: 's4', nombre: 'Corte + Barba', categoria: 'Combos', precio: 55000, duracion: 50, veces: 87 },
  { id: 's5', nombre: 'Afeitado a Navaja', categoria: 'Barba', precio: 32000, duracion: 25, veces: 41 },
  { id: 's6', nombre: 'Tratamiento Capilar', categoria: 'Tratamientos', precio: 60000, duracion: 45, veces: 34 },
  { id: 's7', nombre: 'Combo Premium', categoria: 'Combos', precio: 78000, duracion: 65, veces: 52 },
];

/* Categorías de servicio disponibles para el formulario de alta/edición */
const CATEGORIAS_SERVICIO = ['Cortes', 'Barba', 'Combos', 'Tratamientos'];

/* =========================================================================
   MOCK DATA — INVENTARIO (productos ajenos al servicio de corte)
   ========================================================================= */
const PRODUCTOS_INICIAL = [
  { id: 'p1', nombre: 'Cera mate fijación fuerte', categoria: 'Styling', stock: 18, stockMinimo: 6, unidad: 'unidad', precioVenta: 28000, precioCosto: 15000 },
  { id: 'p2', nombre: 'Gel fijador clásico', categoria: 'Styling', stock: 4, stockMinimo: 6, unidad: 'unidad', precioVenta: 18000, precioCosto: 9500 },
  { id: 'p3', nombre: 'Aceite para barba', categoria: 'Cuidado de barba', stock: 11, stockMinimo: 5, unidad: 'unidad', precioVenta: 32000, precioCosto: 17000 },
  { id: 'p4', nombre: 'Bálsamo para barba', categoria: 'Cuidado de barba', stock: 3, stockMinimo: 5, unidad: 'unidad', precioVenta: 30000, precioCosto: 16000 },
  { id: 'p5', nombre: 'Shampoo anticaspa', categoria: 'Cuidado capilar', stock: 9, stockMinimo: 4, unidad: 'unidad', precioVenta: 26000, precioCosto: 14000 },
  { id: 'p6', nombre: 'Cuchillas de afeitar (paq. x5)', categoria: 'Insumos', stock: 22, stockMinimo: 10, unidad: 'paquete', precioVenta: 12000, precioCosto: 6000 },
  { id: 'p7', nombre: 'Toallas desechables (paq. x50)', categoria: 'Insumos', stock: 2, stockMinimo: 4, unidad: 'paquete', precioVenta: 15000, precioCosto: 8000 },
  { id: 'p8', nombre: 'Cerveza artesanal', categoria: 'Bebidas', stock: 30, stockMinimo: 12, unidad: 'unidad', precioVenta: 9000, precioCosto: 4500 },
  { id: 'p9', nombre: 'Agua en botella', categoria: 'Bebidas', stock: 40, stockMinimo: 15, unidad: 'unidad', precioVenta: 3000, precioCosto: 1200 },
  { id: 'p10', nombre: 'Gaseosa', categoria: 'Bebidas', stock: 6, stockMinimo: 10, unidad: 'unidad', precioVenta: 4000, precioCosto: 1800 },
];
const CATEGORIAS_PRODUCTO = ['Styling', 'Cuidado de barba', 'Cuidado capilar', 'Insumos', 'Bebidas'];

/* =========================================================================
   MOCK DATA — VENTAS DE PRODUCTOS (ajenas al servicio de corte)
   ========================================================================= */
const VENTAS_PRODUCTOS_INICIAL = [
  { id: 'v1', fecha: '2026-07-09', productoId: 'p8', producto: 'Cerveza artesanal', cantidad: 2, precioUnitario: 9000, total: 18000, cliente: 'Sebastián Gómez' },
  { id: 'v2', fecha: '2026-07-09', productoId: 'p1', producto: 'Cera mate fijación fuerte', cantidad: 1, precioUnitario: 28000, total: 28000, cliente: 'Nicolás Peña' },
  { id: 'v3', fecha: '2026-07-08', productoId: 'p3', producto: 'Aceite para barba', cantidad: 1, precioUnitario: 32000, total: 32000, cliente: 'Felipe Ortiz' },
  { id: 'v4', fecha: '2026-07-08', productoId: 'p9', producto: 'Agua en botella', cantidad: 3, precioUnitario: 3000, total: 9000, cliente: '' },
];

const CLIENTES_INICIAL = [
  { id: 'c1', nombre: 'Sebastián Gómez', telefono: '300 412 8871', ultima: '2026-07-09', frecuencia: '2 sem', favorito: 'Combo Premium', gasto: 78000, visitas: 24, etiqueta: 'VIP' },
  { id: 'c2', nombre: 'Mateo Rincón', telefono: '311 220 5563', ultima: '2026-07-06', frecuencia: '3 sem', favorito: 'Corte Moderno (Fade)', gasto: 42000, visitas: 16, etiqueta: 'Frecuente' },
  { id: 'c3', nombre: 'Andrés Villa', telefono: '318 902 4471', ultima: '2026-07-08', frecuencia: '—', favorito: 'Corte Clásico', gasto: 35000, visitas: 1, etiqueta: 'Nuevo' },
  { id: 'c4', nombre: 'Julián Cárdenas', telefono: '320 774 1102', ultima: '2026-05-26', frecuencia: '6+ sem', favorito: 'Corte + Barba', gasto: 55000, visitas: 9, etiqueta: 'Inactivo' },
  { id: 'c5', nombre: 'David Fonseca', telefono: '301 668 9932', ultima: '2026-07-07', frecuencia: '3 sem', favorito: 'Arreglo de Barba', gasto: 25000, visitas: 12, etiqueta: 'Frecuente' },
  { id: 'c6', nombre: 'Nicolás Peña', telefono: '317 553 2287', ultima: '2026-07-09', frecuencia: '2 sem', favorito: 'Combo Premium', gasto: 78000, visitas: 20, etiqueta: 'VIP' },
  { id: 'c7', nombre: 'Santiago Ruiz', telefono: '312 998 4410', ultima: '2026-06-02', frecuencia: '5+ sem', favorito: 'Corte Clásico', gasto: 35000, visitas: 7, etiqueta: 'Inactivo' },
  { id: 'c8', nombre: 'Camilo Duarte', telefono: '304 116 7723', ultima: '2026-07-05', frecuencia: '—', favorito: 'Corte Moderno (Fade)', gasto: 42000, visitas: 1, etiqueta: 'Nuevo' },
  { id: 'c9', nombre: 'Felipe Ortiz', telefono: '316 340 6689', ultima: '2026-07-08', frecuencia: '3 sem', favorito: 'Corte + Barba', gasto: 55000, visitas: 14, etiqueta: 'Frecuente' },
  { id: 'c10', nombre: 'Alejandro Vargas', telefono: '300 887 2245', ultima: '2026-07-09', frecuencia: '2 sem', favorito: 'Tratamiento Capilar', gasto: 60000, visitas: 18, etiqueta: 'VIP' },
];

const HISTORIAL = {
  c1: [
    { fecha: '2026-07-09', servicio: 'Combo Premium', barbero: 'Carlos Ramírez', valor: 78000 },
    { fecha: '2026-06-25', servicio: 'Corte + Barba', barbero: 'Carlos Ramírez', valor: 55000 },
    { fecha: '2026-06-11', servicio: 'Combo Premium', barbero: 'Andrés Torres', valor: 78000 },
  ],
  c6: [
    { fecha: '2026-07-09', servicio: 'Combo Premium', barbero: 'Julián Peña', valor: 78000 },
    { fecha: '2026-06-24', servicio: 'Combo Premium', barbero: 'Julián Peña', valor: 78000 },
  ],
};

const ESTADOS = {
  Confirmada: { color: C.green, bg: C.greenBg, icon: CheckCircle2 },
  Pendiente: { color: C.amber, bg: C.amberBg, icon: Clock },
  Cancelada: { color: C.red, bg: C.redBg, icon: XCircle },
  Finalizada: { color: C.textMuted, bg: 'rgba(169,154,135,0.1)', icon: CheckCircle2 },
};

const CITAS_HOY = [
  { id: 'a1', hora: '09:00', cliente: 'Andrés Villa', telefono: '318 902 4471', servicio: 'Corte Clásico', barbero: 'Julián Peña', estado: 'Finalizada' },
  { id: 'a2', hora: '09:30', cliente: 'David Fonseca', telefono: '301 668 9932', servicio: 'Arreglo de Barba', barbero: 'Andrés Torres', estado: 'Finalizada' },
  { id: 'a3', hora: '10:15', cliente: 'Felipe Ortiz', telefono: '316 340 6689', servicio: 'Corte + Barba', barbero: 'Carlos Ramírez', estado: 'Finalizada' },
  { id: 'a4', hora: '11:00', cliente: 'Camilo Duarte', telefono: '304 116 7723', servicio: 'Corte Moderno (Fade)', barbero: 'Julián Peña', estado: 'Finalizada' },
  { id: 'a5', hora: '13:00', cliente: 'Sebastián Gómez', telefono: '300 412 8871', servicio: 'Combo Premium', barbero: 'Carlos Ramírez', estado: 'Confirmada' },
  { id: 'a6', hora: '14:00', cliente: 'Mateo Rincón', telefono: '311 220 5563', servicio: 'Corte Moderno (Fade)', barbero: 'Andrés Torres', estado: 'Confirmada' },
  { id: 'a7', hora: '15:30', cliente: 'Alejandro Vargas', telefono: '300 887 2245', servicio: 'Tratamiento Capilar', barbero: 'Julián Peña', estado: 'Pendiente' },
  { id: 'a8', hora: '16:00', cliente: 'Nicolás Peña', telefono: '317 553 2287', servicio: 'Combo Premium', barbero: 'Carlos Ramírez', estado: 'Confirmada' },
  { id: 'a9', hora: '17:00', cliente: 'Juan Pablo Roa', telefono: '313 556 9012', servicio: 'Corte Clásico', barbero: 'Andrés Torres', estado: 'Pendiente' },
  { id: 'a10', hora: '18:30', cliente: 'Diego Salazar', telefono: '315 447 3321', servicio: 'Corte + Barba', barbero: 'Julián Peña', estado: 'Cancelada' },
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const REVENUE_SEMANA = [
  { dia: 'Lun', ingresos: 620000 }, { dia: 'Mar', ingresos: 540000 }, { dia: 'Mié', ingresos: 710000 },
  { dia: 'Jue', ingresos: 690000 }, { dia: 'Vie', ingresos: 980000 }, { dia: 'Sáb', ingresos: 1240000 },
  { dia: 'Dom', ingresos: 410000 },
];
const REVENUE_MES = [
  { mes: 'Feb', ingresos: 6200000, clientes: 210 }, { mes: 'Mar', ingresos: 6850000, clientes: 228 },
  { mes: 'Abr', ingresos: 7100000, clientes: 241 }, { mes: 'May', ingresos: 7480000, clientes: 252 },
  { mes: 'Jun', ingresos: 7920000, clientes: 268 }, { mes: 'Jul', ingresos: 8900000, clientes: 289 },
];
const DEMANDA_HORA = [
  { hora: '9am', citas: 4 }, { hora: '10am', citas: 6 }, { hora: '11am', citas: 7 }, { hora: '12pm', citas: 5 },
  { hora: '1pm', citas: 4 }, { hora: '2pm', citas: 3 }, { hora: '3pm', citas: 5 }, { hora: '4pm', citas: 8 },
  { hora: '5pm', citas: 9 }, { hora: '6pm', citas: 10 }, { hora: '7pm', citas: 8 }, { hora: '8pm', citas: 5 },
];
const RENTABILIDAD_DIA = [
  { dia: 'Lun', valor: 620000 }, { dia: 'Mar', valor: 540000 }, { dia: 'Mié', valor: 710000 },
  { dia: 'Jue', valor: 690000 }, { dia: 'Vie', valor: 980000 }, { dia: 'Sáb', valor: 1240000 }, { dia: 'Dom', valor: 410000 },
];
const METODOS_PAGO = [
  { name: 'Efectivo', value: 42, color: C.gold },
  { name: 'Tarjeta', value: 33, color: C.blue },
  { name: 'Transferencia/Nequi', value: 25, color: C.green },
];
const NUEVOS_VS_RECURRENTES = [
  { name: 'Recurrentes', value: 72, color: C.gold },
  { name: 'Nuevos', value: 28, color: C.borderSoft },
];

const ALERTAS = [
  {
    id: 'al1', tipo: 'inactivos', prioridad: 'alta', icon: UserCheck,
    titulo: 'Clientes que no regresan hace tiempo',
    detalle: '2 clientes frecuentes no visitan la barbería hace más de 5 semanas.',
    items: [
      { nombre: 'Julián Cárdenas', dato: '45 días sin visitar' },
      { nombre: 'Santiago Ruiz', dato: '38 días sin visitar' },
    ],
    accion: 'Enviar recordatorio',
  },
  {
    id: 'al2', tipo: 'ocupacion', prioridad: 'media', icon: Activity,
    titulo: 'Horario con baja ocupación',
    detalle: 'Los martes de 2:00pm a 4:00pm tienen solo 35% de ocupación esta semana.',
    items: [],
    accion: 'Crear promoción para ese horario',
  },
  {
    id: 'al3', tipo: 'servicio', prioridad: 'media', icon: Sparkles,
    titulo: 'Servicio con oportunidad de promoción',
    detalle: 'Tratamiento Capilar tiene alto margen pero solo 34 solicitudes este mes.',
    items: [],
    accion: 'Promocionar servicio',
  },
  {
    id: 'al4', tipo: 'recordatorio', prioridad: 'baja', icon: CalendarClock,
    titulo: 'Próximas citas en las siguientes 2 horas',
    detalle: '3 clientes tienen cita confirmada antes de las 5:00pm de hoy.',
    items: [],
    accion: 'Ver agenda',
  },
  {
    id: 'al5', tipo: 'fidelizacion', prioridad: 'baja', icon: Gift,
    titulo: 'Oportunidad de fidelización',
    detalle: '5 clientes VIP visitan más de una vez al mes. Considera un programa de puntos.',
    items: [],
    accion: 'Diseñar programa de fidelidad',
  },
];

/* =========================================================================
   ESTILOS GLOBALES
   ========================================================================= */
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      .bd-root { font-family: 'Inter', system-ui, sans-serif; color: ${C.text}; }
      .bd-display { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }
      .bd-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .bd-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      .bd-scroll::-webkit-scrollbar-track { background: transparent; }
      .bd-card { transition: border-color .15s ease, transform .15s ease; }
      .bd-row:hover { background: ${C.surfaceHover}; }
      .bd-fade-in { animation: bdFadeIn .25s ease both; }
      @keyframes bdFadeIn { from { opacity: 0; transform: translateY(4px);} to { opacity:1; transform:translateY(0);} }
    `}</style>
  );
}

/* =========================================================================
   PRIMITIVOS
   ========================================================================= */
function Badge({ estado }) {
  const cfg = ESTADOS[estado];
  const Icon = cfg.icon;
  return (
    <span style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap">
      <Icon size={12} /> {estado}
    </span>
  );
}

function TagPill({ tag }) {
  const map = {
    VIP: { color: C.gold, bg: 'rgba(199,154,91,0.14)' },
    Frecuente: { color: C.green, bg: C.greenBg },
    Nuevo: { color: C.blue, bg: 'rgba(124,151,172,0.14)' },
    Inactivo: { color: C.red, bg: C.redBg },
  };
  const cfg = map[tag];
  return (
    <span style={{ color: cfg.color, background: cfg.bg }} className="px-2 py-0.5 rounded text-xs font-medium">
      {tag}
    </span>
  );
}

function Trend({ value }) {
  const up = value >= 0;
  return (
    <span style={{ color: up ? C.green : C.red }} className="inline-flex items-center gap-0.5 text-xs font-semibold">
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value)}%
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, sub, trend }) {
  return (
    <div className="bd-card bd-fade-in p-5 rounded-xl relative overflow-hidden"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="absolute top-0 right-0 w-10 h-10" style={{
        background: `linear-gradient(135deg, transparent 50%, ${C.gold}22 50%)`,
      }} />
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(199,154,91,0.12)' }}>
          <Icon size={18} style={{ color: C.gold }} />
        </div>
        {trend !== undefined && <Trend value={trend} />}
      </div>
      <div className="bd-display text-2xl font-semibold leading-none mb-1.5">{value}</div>
      <div className="text-xs" style={{ color: C.textMuted }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: C.textFaint }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, action, children, className = '' }) {
  return (
    <div className={`bd-fade-in rounded-xl p-5 ${className}`} style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="bd-display text-sm font-semibold tracking-wide" style={{ color: C.text }}>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center" style={{ color: C.textFaint }}>
      <Icon size={28} className="mb-2" />
      <div className="text-sm">{text}</div>
    </div>
  );
}

const darkTooltip = { background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text };

/* =========================================================================
   NAVEGACIÓN
   ========================================================================= */
const NAV = [
  { id: 'dashboard', label: 'Panel General', icon: LayoutDashboard },
  { id: 'agenda', label: 'Citas y Agenda', icon: CalendarDays },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'servicios', label: 'Servicios', icon: Scissors },
  { id: 'ingresos', label: 'Ingresos', icon: DollarSign },
  { id: 'metricas', label: 'Métricas', icon: Activity },
  { id: 'alertas', label: 'Alertas', icon: Bell },
  { id: 'empleados', label: 'Empleados', icon: UserPlus },
];

// Ítems de NAV visibles para cada rol dentro de /dashboard.
// 'owner' ve todo (incluida la gestión de empleados y del negocio);
// 'employee' solo ve lo operativo, según lo definido en el alcance de RBAC.
const NAV_BY_ROLE = {
  owner: ['dashboard', 'agenda', 'clientes', 'servicios', 'ingresos', 'metricas', 'alertas', 'empleados'],
  employee: ['dashboard', 'agenda', 'clientes', 'servicios'],
};

const ROLE_LABEL = { owner: 'Propietario', employee: 'Empleado', master: 'Administrador' };

/* Sección separada del core de cortes: inventario y ventas de productos.
   Se muestran en su propio grupo dentro del sidebar, con acento propio. */
const NAV_TIENDA = [
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'ventas', label: 'Ventas Extra', icon: ShoppingBag },
];

// El employee puede registrar/consultar ventas, pero el inventario (stock,
// costos) queda como función administrativa exclusiva del owner.
const NAV_TIENDA_BY_ROLE = {
  owner: ['inventario', 'ventas'],
  employee: ['ventas'],
};

function Sidebar({ active, setActive, mobileOpen, setMobileOpen, userName, roleLabel, navItems, navTienda, onLogout }) {
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed lg:static z-50 top-0 left-0 h-full w-64 flex flex-col transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: C.bgSoft, borderRight: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 px-5 py-6" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center relative" style={{ border: `1.5px solid ${C.gold}` }}>
            <Scissors size={16} style={{ color: C.gold }} />
          </div>
          <div>
            <div className="bd-display text-base font-semibold tracking-wide leading-none">BARBER<span style={{ color: C.gold }}>OS</span></div>
            <div className="text-[10px] mt-1" style={{ color: C.textFaint }}>Panel administrativo</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto bd-scroll">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button key={item.id} onClick={() => { setActive(item.id); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative"
                style={{
                  color: isActive ? C.text : C.textMuted,
                  background: isActive ? C.surface : 'transparent',
                }}>
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ background: C.gold }} />}
                <Icon size={17} style={{ color: isActive ? C.gold : C.textFaint }} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}

          {navTienda.length > 0 && (
            <div className="pt-4 mt-2" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.textFaint }}>Tienda</div>
              {navTienda.map(item => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button key={item.id} onClick={() => { setActive(item.id); setMobileOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative"
                    style={{
                      color: isActive ? C.text : C.textMuted,
                      background: isActive ? INV.accentBg : 'transparent',
                    }}>
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ background: INV.accent }} />}
                    <Icon size={17} style={{ color: isActive ? INV.accentBright : C.textFaint }} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        <div className="p-4 mx-3 mb-4 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ background: C.gold, color: C.bg }}>
              {(userName || 'Usuario').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{userName || 'Usuario'}</div>
              <div className="text-[11px] truncate" style={{ color: C.textFaint }}>{roleLabel}</div>
            </div>
            <button onClick={onLogout} title="Cerrar sesión" className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ border: `1px solid ${C.border}` }}>
              <LogOut size={13} style={{ color: C.textFaint }} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ title, subtitle, setMobileOpen, onNuevaCita }) {
  return (
    <div className="flex items-center gap-4 px-5 lg:px-8 py-5 sticky top-0 z-30" style={{ background: `${C.bg}ee`, backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}` }}>
      <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
      <div className="min-w-0">
        <h1 className="bd-display text-lg lg:text-xl font-semibold leading-none">{title}</h1>
        {subtitle && <p className="text-xs mt-1.5" style={{ color: C.textMuted }}>{subtitle}</p>}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Search size={14} style={{ color: C.textFaint }} />
          <input placeholder="Buscar cliente, cita..." className="bg-transparent text-xs outline-none w-40" style={{ color: C.text }} />
        </div>
        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Bell size={16} style={{ color: C.textMuted }} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: C.gold }} />
        </button>
        {onNuevaCita && (
          <button onClick={onNuevaCita} className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: C.gold, color: '#1A1207' }}>
            <Plus size={15} /> Nueva cita
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   VISTA: DASHBOARD
   ========================================================================= */
function DashboardView({ onNuevaCita, servicios }) {
  const citasHoy = CITAS_HOY.length;
  const pendientes = CITAS_HOY.filter(c => c.estado === 'Pendiente').length;
  const finalizadas = CITAS_HOY.filter(c => c.estado === 'Finalizada').length;
  const ingresosHoy = 410000;
  const ingresosSemana = REVENUE_SEMANA.reduce((a, d) => a + d.ingresos, 0);
  const ingresosMes = REVENUE_MES[REVENUE_MES.length - 1].ingresos;
  const topServicios = [...servicios].sort((a, b) => b.veces - a.veces).slice(0, 5);
  const proximas = CITAS_HOY.filter(c => c.estado === 'Confirmada' || c.estado === 'Pendiente').slice(0, 5);

  return (
    <div className="space-y-6 bd-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={CalendarDays} label="Citas programadas hoy" value={citasHoy} sub={`${finalizadas} finalizadas · ${pendientes} pendientes`} trend={9} />
        <KpiCard icon={UserCheck} label="Clientes atendidos hoy" value={finalizadas} sub="Meta diaria: 16" trend={4} />
        <KpiCard icon={DollarSign} label="Ingresos de hoy" value={fmtCompact(ingresosHoy)} sub="vs. mismo día semana pasada" trend={12} />
        <KpiCard icon={Activity} label="Tasa de ocupación" value="78%" sub="Agenda de hoy" trend={-3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SectionCard title="Ingresos de la semana" className="xl:col-span-2">
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="bd-display text-2xl font-semibold">{fmtCOP(ingresosSemana)}</div>
              <div className="text-xs mt-1" style={{ color: C.textFaint }}>Semana del 6 al 12 de julio</div>
            </div>
            <Trend value={8} />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={REVENUE_SEMANA} margin={{ left: -20, top: 10 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="dia" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={50} />
              <Tooltip contentStyle={darkTooltip} formatter={(v) => fmtCOP(v)} />
              <Area type="monotone" dataKey="ingresos" stroke={C.gold} strokeWidth={2} fill="url(#gRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Servicios más solicitados">
          <div className="space-y-3.5">
            {topServicios.map((s, i) => (
              <div key={s.id}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: C.text }} className="font-medium">{i + 1}. {s.nombre}</span>
                  <span style={{ color: C.textFaint }}>{s.veces}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: C.border }}>
                  <div className="h-full rounded-full" style={{ width: `${(s.veces / topServicios[0].veces) * 100}%`, background: C.gold }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SectionCard title="Próximas citas" className="xl:col-span-2" action={<span className="text-xs" style={{ color: C.textFaint }}>Hoy</span>}>
          <div className="space-y-2">
            {proximas.map(c => (
              <div key={c.id} className="bd-row flex items-center gap-3 p-2.5 rounded-lg" style={{ border: `1px solid ${C.borderSoft}` }}>
                <div className="text-xs font-semibold w-12" style={{ color: C.gold }}>{c.hora}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.cliente}</div>
                  <div className="text-xs truncate" style={{ color: C.textFaint }}>{c.servicio} · {c.barbero}</div>
                </div>
                <Badge estado={c.estado} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Crecimiento del negocio">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs" style={{ color: C.textMuted }}>Semana vs. anterior</div>
                <div className="bd-display text-lg font-semibold">{fmtCompact(ingresosSemana)}</div>
              </div>
              <Trend value={8} />
            </div>
            <div className="h-px" style={{ background: C.border }} />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs" style={{ color: C.textMuted }}>Mes vs. anterior</div>
                <div className="bd-display text-lg font-semibold">{fmtCompact(ingresosMes)}</div>
              </div>
              <Trend value={15} />
            </div>
            <div className="h-px" style={{ background: C.border }} />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs" style={{ color: C.textMuted }}>Clientes nuevos este mes</div>
                <div className="bd-display text-lg font-semibold">31</div>
              </div>
              <Trend value={6} />
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* =========================================================================
   VISTA: AGENDA
   ========================================================================= */
function CitaModal({ servicios, onClose, onSave }) {
  const [form, setForm] = useState({ cliente: '', telefono: '', servicio: servicios[0]?.nombre || '', barbero: BARBEROS[0].nombre, hora: '10:00' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 bd-fade-in" style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="bd-display text-base font-semibold">Nueva cita</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Nombre del cliente</label>
            <input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }} placeholder="Ej. Andrés Villa" />
          </div>
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Teléfono</label>
            <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }} placeholder="300 000 0000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Servicio</label>
              <select value={form.servicio} onChange={e => setForm({ ...form, servicio: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }}>
                {servicios.map(s => <option key={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Barbero</label>
              <select value={form.barbero} onChange={e => setForm({ ...form, barbero: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }}>
                {BARBEROS.map(b => <option key={b.id}>{b.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Hora</label>
            <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
          <button onClick={() => { if (form.cliente) { onSave(form); onClose(); } }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.gold, color: '#1A1207' }}>Guardar cita</button>
        </div>
      </div>
    </div>
  );
}

function AgendaView({ citas, setCitas }) {
  const [vista, setVista] = useState('Día');
  const [filtro, setFiltro] = useState('Todas');

  const filtradas = filtro === 'Todas' ? citas : citas.filter(c => c.estado === filtro);

  const cambiarEstado = (id, estado) => setCitas(citas.map(c => c.id === id ? { ...c, estado } : c));

  return (
    <div className="space-y-6 bd-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          {['Día', 'Semana', 'Mes'].map(v => (
            <button key={v} onClick={() => setVista(v)} className="px-4 py-2 text-xs font-medium"
              style={{ background: vista === v ? C.surface : 'transparent', color: vista === v ? C.gold : C.textMuted }}>{v}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {['Todas', 'Confirmada', 'Pendiente', 'Finalizada', 'Cancelada'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: filtro === f ? 'rgba(199,154,91,0.14)' : 'transparent', color: filtro === f ? C.gold : C.textFaint, border: `1px solid ${filtro === f ? C.gold + '55' : C.border}` }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {vista === 'Semana' ? (
        <SectionCard title="Vista semanal">
          <div className="overflow-x-auto bd-scroll">
            <div className="grid gap-2 min-w-[700px]" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {DIAS_SEMANA.map((d, i) => (
                <div key={d} className="rounded-lg p-2" style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}` }}>
                  <div className="text-xs font-semibold mb-2 text-center" style={{ color: i === 4 ? C.gold : C.textMuted }}>{d} {6 + i}</div>
                  <div className="space-y-1.5">
                    {filtradas.filter((_, idx) => idx % 7 === i).slice(0, 3).map(c => (
                      <div key={c.id} className="text-[10px] p-1.5 rounded" style={{ background: C.surface, color: C.textMuted, borderLeft: `2px solid ${ESTADOS[c.estado].color}` }}>
                        <div className="font-medium" style={{ color: C.text }}>{c.hora}</div>
                        <div className="truncate">{c.cliente}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : vista === 'Mes' ? (
        <SectionCard title="Julio 2026">
          <div className="grid grid-cols-7 gap-2 text-center mb-2">
            {DIAS_SEMANA.map(d => <div key={d} className="text-xs" style={{ color: C.textFaint }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 31 }).map((_, i) => {
              const day = i + 1;
              const count = day % 4 === 0 ? 3 : day % 3 === 0 ? 5 : day % 2 === 0 ? 2 : 0;
              const isToday = day === 10;
              return (
                <div key={i} className="rounded-lg p-2 h-16 flex flex-col justify-between"
                  style={{ background: isToday ? 'rgba(199,154,91,0.1)' : C.bgSoft, border: `1px solid ${isToday ? C.gold + '66' : C.borderSoft}` }}>
                  <span className="text-xs" style={{ color: isToday ? C.gold : C.textMuted }}>{day}</span>
                  {count > 0 && <span className="text-[10px] self-start px-1.5 rounded-full" style={{ background: C.surface, color: C.textFaint }}>{count} citas</span>}
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Agenda de hoy — jueves 10 de julio">
          <div className="space-y-2">
            {filtradas.map(c => (
              <div key={c.id} className="bd-row flex flex-wrap items-center gap-3 p-3 rounded-lg" style={{ border: `1px solid ${C.borderSoft}` }}>
                <div className="flex items-center gap-2 w-16">
                  <Clock size={13} style={{ color: C.textFaint }} />
                  <span className="text-xs font-semibold" style={{ color: C.gold }}>{c.hora}</span>
                </div>
                <div className="min-w-[140px] flex-1">
                  <div className="text-sm font-medium">{c.cliente}</div>
                  <div className="text-xs flex items-center gap-1" style={{ color: C.textFaint }}><Phone size={11} />{c.telefono}</div>
                </div>
                <div className="text-xs hidden sm:block" style={{ color: C.textMuted }}>{c.servicio}</div>
                <div className="text-xs hidden md:block" style={{ color: C.textFaint }}>{c.barbero}</div>
                <Badge estado={c.estado} />
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={() => cambiarEstado(c.id, 'Confirmada')} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Confirmar"><Pencil size={12} style={{ color: C.textMuted }} /></button>
                  <button onClick={() => cambiarEstado(c.id, 'Cancelada')} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Cancelar"><Trash2 size={12} style={{ color: C.red }} /></button>
                </div>
              </div>
            ))}
            {filtradas.length === 0 && <EmptyState icon={CalendarX} text="No hay citas con este filtro." />}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* =========================================================================
   VISTA: CLIENTES
   ========================================================================= */
function ClienteDrawer({ cliente, onClose }) {
  const historial = HISTORIAL[cliente.id] || [];
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
        <h4 className="text-xs font-semibold mb-3" style={{ color: C.textMuted }}>HISTORIAL DE SERVICIOS</h4>
        <div className="space-y-2">
          {historial.length ? historial.map((h, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{ border: `1px solid ${C.borderSoft}` }}>
              <div>
                <div className="text-xs font-medium">{h.servicio}</div>
                <div className="text-[10px]" style={{ color: C.textFaint }}>{h.fecha} · {h.barbero}</div>
              </div>
              <div className="text-xs font-semibold" style={{ color: C.gold }}>{fmtCOP(h.valor)}</div>
            </div>
          )) : <EmptyState icon={Clock} text="Sin historial detallado disponible." />}
        </div>
        <button className="w-full mt-6 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: C.gold, color: '#1A1207' }}>
          <MessageCircle size={15} /> Enviar mensaje
        </button>
      </div>
    </div>
  );
}

function ClientesView({ clientes }) {
  const [busca, setBusca] = useState('');
  const [tag, setTag] = useState('Todos');
  const [seleccionado, setSeleccionado] = useState(null);

  const filtrados = clientes.filter(c =>
    (tag === 'Todos' || c.etiqueta === tag) &&
    c.nombre.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-5 bd-fade-in">
      {seleccionado && <ClienteDrawer cliente={seleccionado} onClose={() => setSeleccionado(null)} />}

      <SectionCard>
        <div className="flex items-center gap-3">
          <UserCheck size={16} style={{ color: C.gold }} />
          <div className="text-xs" style={{ color: C.textMuted }}>
            Esta lista se actualiza sola: cada vez que registrás una <strong style={{ color: C.text }}>nueva cita</strong>, el teléfono y el último servicio del cliente se cargan automáticamente acá.
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Search size={14} style={{ color: C.textFaint }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente por nombre..." className="bg-transparent text-sm outline-none w-full" style={{ color: C.text }} />
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
              {filtrados.map(c => (
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
          {filtrados.length === 0 && <EmptyState icon={Users} text="No se encontraron clientes." />}
        </div>
      </SectionCard>
    </div>
  );
}

/* =========================================================================
   VISTA: SERVICIOS
   ========================================================================= */
function ServicioModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { nombre: '', categoria: CATEGORIAS_SERVICIO[0], precio: '', duracion: '' });
  const esEdicion = !!initial;

  const puedeGuardar = form.nombre.trim().length > 1 && Number(form.precio) > 0 && Number(form.duracion) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 bd-fade-in" style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="bd-display text-base font-semibold">{esEdicion ? 'Editar servicio' : 'Nuevo servicio'}</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.textMuted }} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Nombre del servicio</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }} placeholder="Ej. Corte Clásico" />
          </div>
          <div>
            <label className="text-xs" style={{ color: C.textMuted }}>Categoría</label>
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }}>
              {CATEGORIAS_SERVICIO.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Precio (COP)</label>
              <input type="number" min="0" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }} placeholder="35000" />
            </div>
            <div>
              <label className="text-xs" style={{ color: C.textMuted }}>Duración (min)</label>
              <input type="number" min="0" value={form.duracion} onChange={e => setForm({ ...form, duracion: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }} placeholder="30" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
          <button
            disabled={!puedeGuardar}
            onClick={() => { onSave({ ...form, precio: Number(form.precio), duracion: Number(form.duracion) }); onClose(); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ background: puedeGuardar ? C.gold : C.borderSoft, color: puedeGuardar ? '#1A1207' : C.textFaint }}>
            <Save size={14} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiciosView({ servicios, onAdd, onEdit, onDelete, readOnly = false }) {
  const [modal, setModal] = useState(null); // null | 'new' | servicio-object
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);

  const totalServiceRevenue = servicios.reduce((a, s) => a + s.precio * s.veces, 0) || 1;
  const masSolicitado = servicios.length ? [...servicios].sort((a, b) => b.veces - a.veces)[0] : null;

  return (
    <div className="space-y-5 bd-fade-in">
      {!readOnly && modal && (
        <ServicioModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={(data) => modal === 'new' ? onAdd(data) : onEdit(modal.id, data)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Scissors} label="Servicios activos" value={servicios.length} />
        <KpiCard icon={Flame} label="Más solicitado" value={masSolicitado?.nombre || '—'} sub={masSolicitado ? `${masSolicitado.veces} veces este mes` : ''} />
        <KpiCard icon={DollarSign} label="Ingreso total por servicios" value={fmtCompact(totalServiceRevenue)} />
      </div>
      <SectionCard title="Catálogo de servicios" action={
        !readOnly && (
          <button onClick={() => setModal('new')} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: C.gold, color: '#1A1207' }}>
            <Plus size={14} /> Nuevo servicio
          </button>
        )
      }>
        <div className="overflow-x-auto bd-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: C.textFaint }}>
                <th className="pb-3 font-medium">Servicio</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Categoría</th>
                <th className="pb-3 font-medium">Precio</th>
                <th className="pb-3 font-medium hidden md:table-cell">Duración</th>
                <th className="pb-3 font-medium">Solicitudes</th>
                <th className="pb-3 font-medium">Rentabilidad</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {[...servicios].sort((a, b) => (b.precio * b.veces) - (a.precio * a.veces)).map(s => {
                const ingresos = s.precio * s.veces;
                const share = (ingresos / totalServiceRevenue) * 100;
                return (
                  <tr key={s.id} className="bd-row" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                    <td className="py-3 font-medium">{s.nombre}</td>
                    <td className="py-3 hidden sm:table-cell" style={{ color: C.textMuted }}>{s.categoria}</td>
                    <td className="py-3" style={{ color: C.textMuted }}>{fmtCOP(s.precio)}</td>
                    <td className="py-3 hidden md:table-cell" style={{ color: C.textMuted }}>{s.duracion} min</td>
                    <td className="py-3" style={{ color: C.textMuted }}>{s.veces}</td>
                    <td className="py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full flex-1" style={{ background: C.border }}>
                          <div className="h-full rounded-full" style={{ width: `${share}%`, background: C.gold }} />
                        </div>
                        <span className="text-xs" style={{ color: C.textFaint }}>{share.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {!readOnly && (
                        <>
                          <button onClick={() => setModal(s)} className="w-7 h-7 rounded-md inline-flex items-center justify-center mr-1" style={{ border: `1px solid ${C.border}` }} title="Editar">
                            <Pencil size={12} style={{ color: C.textMuted }} />
                          </button>
                          <button onClick={() => setConfirmarBorrar(s)} className="w-7 h-7 rounded-md inline-flex items-center justify-center" style={{ border: `1px solid ${C.border}` }} title="Eliminar">
                            <Trash2 size={12} style={{ color: C.red }} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {servicios.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon={Scissors} text="Todavía no tenés servicios cargados." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {!readOnly && confirmarBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setConfirmarBorrar(null)}>
          <div className="w-full max-w-sm rounded-xl p-6 bd-fade-in" style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
            <h3 className="bd-display text-base font-semibold mb-2">¿Eliminar servicio?</h3>
            <p className="text-xs mb-5" style={{ color: C.textMuted }}>Vas a eliminar <strong style={{ color: C.text }}>{confirmarBorrar.nombre}</strong> del catálogo. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarBorrar(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
              <button onClick={() => { onDelete(confirmarBorrar.id); setConfirmarBorrar(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.red, color: '#fff' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   VISTA: INGRESOS
   ========================================================================= */
function IngresosView({ servicios }) {
  const [periodo, setPeriodo] = useState('Semana');
  const data = periodo === 'Mes' ? REVENUE_MES.map(d => ({ x: d.mes, y: d.ingresos })) : REVENUE_SEMANA.map(d => ({ x: d.dia, y: d.ingresos }));
  const serviciosPorIngreso = [...servicios].sort((a, b) => (b.precio * b.veces) - (a.precio * a.veces)).map(s => ({ name: s.nombre.split(' ')[0], ingresos: s.precio * s.veces }));

  return (
    <div className="space-y-5 bd-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Ingresos del mes" value={fmtCompact(REVENUE_MES[5].ingresos)} trend={15} />
        <KpiCard icon={Scissors} label="Servicios realizados" value="289" trend={6} />
        <KpiCard icon={Award} label="Ticket promedio" value={fmtCOP(REVENUE_MES[5].ingresos / 289)} trend={5} />
        <KpiCard icon={TrendingUp} label="Servicio top en ingresos" value="Combo Premium" sub={fmtCompact(78000 * 52)} />
      </div>

      <SectionCard title={`Tendencia de ingresos — ${periodo}`} action={
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          {['Semana', 'Mes'].map(p => (
            <button key={p} onClick={() => setPeriodo(p)} className="px-3 py-1.5 text-xs font-medium" style={{ background: periodo === p ? C.bgSoft : 'transparent', color: periodo === p ? C.gold : C.textMuted }}>{p}</button>
          ))}
        </div>
      }>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ left: -20, top: 10 }}>
            <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="x" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={50} />
            <Tooltip contentStyle={darkTooltip} formatter={(v) => fmtCOP(v)} />
            <Line type="monotone" dataKey="y" stroke={C.gold} strokeWidth={2.5} dot={{ fill: C.gold, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Comparación de ingresos por servicio">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serviciosPorIngreso} margin={{ left: -20, top: 10 }}>
              <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={C.textFaint} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={50} />
              <Tooltip contentStyle={darkTooltip} formatter={(v) => fmtCOP(v)} />
              <Bar dataKey="ingresos" fill={C.gold} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Métodos de pago utilizados">
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={METODOS_PAGO} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={3}>
                  {METODOS_PAGO.map((m, i) => <Cell key={i} fill={m.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={darkTooltip} formatter={(v) => v + '%'} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2.5">
              {METODOS_PAGO.map(m => (
                <div key={m.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                  <span style={{ color: C.textMuted }}>{m.name}</span>
                  <span className="font-semibold ml-auto">{m.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* =========================================================================
   VISTA: MÉTRICAS
   ========================================================================= */
function ServicioTop(servicios) {
  if (!servicios.length) return '—';
  return servicios.reduce((a, b) => (a.veces > b.veces ? a : b)).nombre;
}
function MetricasView({ servicios }) {
  const ocupacion = 78;
  const radialData = [{ name: 'Ocupación', value: ocupacion, fill: C.gold }];
  return (
    <div className="space-y-5 bd-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Clientes nuevos vs. recurrentes">
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={NUEVOS_VS_RECURRENTES} dataKey="value" innerRadius={38} outerRadius={62} paddingAngle={3}>
                  {NUEVOS_VS_RECURRENTES.map((m, i) => <Cell key={i} fill={m.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={darkTooltip} formatter={(v) => v + '%'} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2.5">
              {NUEVOS_VS_RECURRENTES.map(m => (
                <div key={m.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                  <span style={{ color: C.textMuted }}>{m.name}</span>
                  <span className="font-semibold ml-auto">{m.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Tasa de ocupación de la agenda">
          <ResponsiveContainer width="100%" height={150}>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={20} background={{ fill: C.bgSoft }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-center -mt-24 mb-16">
            <div className="bd-display text-2xl font-semibold">{ocupacion}%</div>
            <div className="text-xs" style={{ color: C.textFaint }}>Esta semana</div>
          </div>
        </SectionCard>

        <SectionCard title="Servicio más vendido">
          <div className="flex flex-col items-center justify-center h-full py-4 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(199,154,91,0.14)' }}>
              <Award size={24} style={{ color: C.gold }} />
            </div>
            <div className="bd-display text-base font-semibold">{ServicioTop(servicios)}</div>
            <div className="text-xs mt-1" style={{ color: C.textFaint }}>142 solicitudes este mes</div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Horarios con mayor demanda">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={DEMANDA_HORA} margin={{ left: -20, top: 10 }}>
              <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="hora" stroke={C.textFaint} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={darkTooltip} />
              <Bar dataKey="citas" radius={[4, 4, 0, 0]}>
                {DEMANDA_HORA.map((d, i) => <Cell key={i} fill={d.citas >= 8 ? C.gold : C.goldDim} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Días más rentables">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={RENTABILIDAD_DIA} margin={{ left: -20, top: 10 }}>
              <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="dia" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={45} />
              <Tooltip contentStyle={darkTooltip} formatter={(v) => fmtCOP(v)} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {RENTABILIDAD_DIA.map((d, i) => <Cell key={i} fill={d.dia === 'Sáb' ? C.gold : C.goldDim} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <SectionCard title="Evolución mensual del negocio">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={REVENUE_MES} margin={{ left: -10, top: 10 }}>
            <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="mes" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={50} />
            <YAxis yAxisId="right" orientation="right" stroke={C.textFaint} fontSize={11} tickLine={false} axisLine={false} width={35} />
            <Tooltip contentStyle={darkTooltip} formatter={(v, n) => n === 'ingresos' ? fmtCOP(v) : v} />
            <Line yAxisId="left" type="monotone" dataKey="ingresos" stroke={C.gold} strokeWidth={2.5} dot={{ fill: C.gold, r: 3 }} name="Ingresos" />
            <Line yAxisId="right" type="monotone" dataKey="clientes" stroke={C.blue} strokeWidth={2} dot={{ fill: C.blue, r: 3 }} name="Clientes" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-5 mt-2 justify-center text-xs">
          <span className="flex items-center gap-1.5" style={{ color: C.textMuted }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: C.gold }} />Ingresos</span>
          <span className="flex items-center gap-1.5" style={{ color: C.textMuted }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: C.blue }} />Clientes atendidos</span>
        </div>
      </SectionCard>
    </div>
  );
}

/* =========================================================================
   VISTA: ALERTAS
   ========================================================================= */
function AlertasView() {
  const prioColor = { alta: C.red, media: C.amber, baja: C.green };
  return (
    <div className="space-y-4 bd-fade-in">
      <SectionCard>
        <div className="flex items-center gap-3">
          <Sparkles size={18} style={{ color: C.gold }} />
          <div>
            <div className="text-sm font-medium">Recomendaciones automáticas</div>
            <div className="text-xs" style={{ color: C.textFaint }}>Generadas a partir de la actividad reciente de tu barbería.</div>
          </div>
        </div>
      </SectionCard>

      {ALERTAS.map(a => {
        const Icon = a.icon;
        return (
          <div key={a.id} className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${prioColor[a.prioridad]}1f` }}>
                <Icon size={18} style={{ color: prioColor[a.prioridad] }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold">{a.titulo}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide" style={{ color: prioColor[a.prioridad], background: `${prioColor[a.prioridad]}1f` }}>
                    Prioridad {a.prioridad}
                  </span>
                </div>
                <p className="text-xs mt-1.5" style={{ color: C.textMuted }}>{a.detalle}</p>
                {a.items.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {a.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: C.bgSoft, border: `1px solid ${C.borderSoft}` }}>
                        <span className="font-medium">{it.nombre}</span>
                        <span style={{ color: C.textFaint }}>· {it.dato}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg" style={{ background: C.gold, color: '#1A1207' }}>
                  <Send size={12} /> {a.accion}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
   VISTA: INVENTARIO
   Sección "tienda", ajena al servicio de corte — usa la paleta INV para
   distinguirse visualmente del resto del panel (dorado/cuero de barbería).
   ========================================================================= */
function ProductoModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { nombre: '', categoria: CATEGORIAS_PRODUCTO[0], stock: '', stockMinimo: '', unidad: 'unidad', precioVenta: '', precioCosto: '' });
  const esEdicion = !!initial;
  const puedeGuardar = form.nombre.trim().length > 1 && Number(form.precioVenta) > 0 && form.stock !== '' && form.stockMinimo !== '';

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
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
          <button
            disabled={!puedeGuardar}
            onClick={() => { onSave({ ...form, stock: Number(form.stock), stockMinimo: Number(form.stockMinimo), precioVenta: Number(form.precioVenta), precioCosto: Number(form.precioCosto) || 0 }); onClose(); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ background: puedeGuardar ? INV.accent : C.borderSoft, color: puedeGuardar ? '#fff' : C.textFaint }}>
            <Save size={14} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function InventarioView({ productos, onAdd, onEdit, onDelete }) {
  const [modal, setModal] = useState(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
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
              {filtrados.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={Package} text="No hay productos en esta categoría." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmarBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setConfirmarBorrar(null)}>
          <div className="w-full max-w-sm rounded-xl p-6 bd-fade-in" style={{ background: INV.surface, border: `1px solid ${INV.border}` }} onClick={e => e.stopPropagation()}>
            <h3 className="bd-display text-base font-semibold mb-2">¿Eliminar producto?</h3>
            <p className="text-xs mb-5" style={{ color: C.textMuted }}>Vas a eliminar <strong style={{ color: C.text }}>{confirmarBorrar.nombre}</strong> del inventario.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarBorrar(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
              <button onClick={() => { onDelete(confirmarBorrar.id); setConfirmarBorrar(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.red, color: '#fff' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   VISTA: VENTAS EXTRA (productos ajenos al servicio de corte)
   ========================================================================= */
function VentaModal({ productos, onClose, onSave }) {
  const disponibles = productos.filter(p => p.stock > 0);
  const [form, setForm] = useState({ productoId: disponibles[0]?.id || '', cantidad: 1, cliente: '' });
  const productoSel = productos.find(p => p.id === form.productoId);
  const maxCantidad = productoSel?.stock || 1;
  const puedeGuardar = productoSel && form.cantidad > 0 && form.cantidad <= maxCantidad;

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
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${INV.border}`, color: C.textMuted }}>Cancelar</button>
          <button
            disabled={!puedeGuardar}
            onClick={() => {
              onSave({
                productoId: productoSel.id,
                producto: productoSel.nombre,
                cantidad: form.cantidad,
                precioUnitario: productoSel.precioVenta,
                total: productoSel.precioVenta * form.cantidad,
                cliente: form.cliente,
              });
              onClose();
            }}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ background: puedeGuardar ? INV.accent : C.borderSoft, color: puedeGuardar ? '#fff' : C.textFaint }}>
            <ShoppingBag size={14} /> Registrar venta
          </button>
        </div>
      </div>
    </div>
  );
}

function VentasView({ productos, ventas, onAddVenta }) {
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
            Ventas de productos que no son parte del servicio de corte — gel, cera, cerveza, y demás. Cada venta descuenta el stock automáticamente en Inventario.
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
              {[...ventas].reverse().map(v => (
                <tr key={v.id} className="bd-row" style={{ borderTop: `1px solid ${INV.border}` }}>
                  <td className="py-3" style={{ color: C.textMuted }}>{v.fecha}</td>
                  <td className="py-3 font-medium">{v.producto}</td>
                  <td className="py-3" style={{ color: C.textMuted }}>{v.cantidad}</td>
                  <td className="py-3 hidden sm:table-cell" style={{ color: C.textMuted }}>{v.cliente || '—'}</td>
                  <td className="py-3 font-medium" style={{ color: INV.accentBright }}>{fmtCOP(v.total)}</td>
                </tr>
              ))}
              {ventas.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon={ShoppingBag} text="Todavía no registraste ventas de productos." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   APP PRINCIPAL
   ========================================================================= */
const TITLES = {
  dashboard: ['Panel General', 'Resumen operativo de tu barbería, hoy jueves 10 de julio'],
  agenda: ['Citas y Agenda', 'Programa, confirma y organiza las citas del día'],
  clientes: ['Clientes', 'Historial y relación con tus clientes'],
  servicios: ['Servicios', 'Catálogo, precios y rentabilidad'],
  ingresos: ['Ingresos', 'Análisis financiero del negocio'],
  metricas: ['Métricas del Negocio', 'Indicadores clave de desempeño'],
  alertas: ['Alertas Inteligentes', 'Recomendaciones para mejorar tu operación'],
  inventario: ['Inventario', 'Stock y catálogo de productos ajenos al corte'],
  ventas: ['Ventas Extra', 'Productos vendidos fuera del servicio de corte'],
  empleados: ['Empleados', 'Gestioná el equipo de tu negocio'],
};

/* -------------------------------------------------------------------------
   Actualiza (o crea) el registro de un cliente a partir de una cita o venta,
   cargando automáticamente su teléfono y su último servicio/compra. Esto es
   lo que alimenta la "lista dinámica" de la vista Clientes.
   ------------------------------------------------------------------------- */
function upsertClienteDesdeCita(clientesActuales, { cliente, telefono, servicio, fecha, precio }) {
  if (!cliente || !cliente.trim()) return clientesActuales;
  const nombreNorm = cliente.trim();
  const idx = clientesActuales.findIndex(c =>
    (telefono && c.telefono === telefono) || c.nombre.toLowerCase() === nombreNorm.toLowerCase()
  );

  if (idx >= 0) {
    const actualizado = {
      ...clientesActuales[idx],
      telefono: telefono || clientesActuales[idx].telefono,
      ultima: fecha,
      favorito: servicio || clientesActuales[idx].favorito,
      visitas: clientesActuales[idx].visitas + 1,
      gasto: precio || clientesActuales[idx].gasto,
      etiqueta: clientesActuales[idx].etiqueta === 'Nuevo' ? 'Frecuente' : clientesActuales[idx].etiqueta,
    };
    const copia = [...clientesActuales];
    copia[idx] = actualizado;
    return copia;
  }

  return [
    ...clientesActuales,
    {
      id: 'c' + Date.now(),
      nombre: nombreNorm,
      telefono: telefono || '—',
      ultima: fecha,
      frecuencia: '—',
      favorito: servicio || '—',
      gasto: precio || 0,
      visitas: 1,
      etiqueta: 'Nuevo',
    },
  ];
}

/* =========================================================================
   VISTA: EMPLEADOS (solo owner)
   Gestión mínima del equipo del negocio: alta de empleados y listado.
   Los empleados creados aquí quedan atados automáticamente al businessId
   del owner (ver AuthContext.createEmployee) — nunca eligen su propio rol
   ni negocio.
   ========================================================================= */
function EmpleadosModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Ingresá el nombre del empleado.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Ingresá un correo válido.');
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    const result = onSave(form);
    if (!result.ok) { setError(result.error); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl p-6 bd-fade-in" style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <h3 className="bd-display text-base font-semibold mb-4">Nuevo empleado</h3>
        {error && <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: C.redBg, color: C.red }}>{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: C.textMuted }}>Nombre</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: C.textMuted }}>Correo</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: C.textMuted }}>Contraseña temporal</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>Cancelar</button>
            <button type="submit" className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.gold, color: '#1A1207' }}>Crear empleado</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmpleadosView({ empleados, onCreate }) {
  const [modal, setModal] = useState(false);

  return (
    <div className="space-y-5 bd-fade-in">
      {modal && <EmpleadosModal onClose={() => setModal(false)} onSave={onCreate} />}
      <SectionCard title="Equipo del negocio" action={
        <button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: C.gold, color: '#1A1207' }}>
          <UserPlus size={14} /> Nuevo empleado
        </button>
      }>
        <div className="overflow-x-auto bd-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: C.textFaint }}>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">Correo</th>
                <th className="pb-3 font-medium">Rol</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map(emp => (
                <tr key={emp.id} className="bd-row" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td className="py-3 font-medium">{emp.name}</td>
                  <td className="py-3" style={{ color: C.textMuted }}>{emp.email}</td>
                  <td className="py-3" style={{ color: C.textMuted }}>Empleado</td>
                </tr>
              ))}
              {empleados.length === 0 && (
                <tr><td colSpan={3}><EmptyState icon={Users} text="Todavía no tenés empleados registrados." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout, business, createEmployee, listEmployees } = useAuth();
  const role = user?.role === 'employee' ? 'employee' : 'owner'; // fallback defensivo
  const [active, setActive] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [citas, setCitas] = useState(CITAS_HOY);
  const [servicios, setServicios] = useState(SERVICIOS_INICIAL);
  const [clientes, setClientes] = useState(CLIENTES_INICIAL);
  const [productos, setProductos] = useState(PRODUCTOS_INICIAL);
  const [ventasProductos, setVentasProductos] = useState(VENTAS_PRODUCTOS_INICIAL);
  const [empleadosVersion, setEmpleadosVersion] = useState(0); // fuerza refresco tras crear empleado
  const [title, subtitle] = TITLES[active];

  // Menú filtrado según el rol: RoleRoute ya garantizó que solo owner/employee
  // llegan hasta acá, así que alcanza con distinguir esos dos casos.
  const allowedIds = NAV_BY_ROLE[role] || NAV_BY_ROLE.employee;
  const navItems = NAV.filter(item => allowedIds.includes(item.id));
  const allowedTiendaIds = NAV_TIENDA_BY_ROLE[role] || [];
  const navTienda = NAV_TIENDA.filter(item => allowedTiendaIds.includes(item.id));

  const empleados = useMemo(() => listEmployees(), [listEmployees, empleadosVersion]);
  const handleCreateEmpleado = (data) => {
    const result = createEmployee(data);
    if (result.ok) setEmpleadosVersion(v => v + 1);
    return result;
  };

  // --- Citas ---
  // Se renderiza a nivel de la app (no dentro de AgendaView) para que el
  // botón "Nueva cita" del Topbar funcione sin importar el menú activo.
  const handleGuardarCita = (form) => {
    const servicioInfo = servicios.find(s => s.nombre === form.servicio);
    setCitas(prev => [...prev, { id: 'a' + Date.now(), ...form, estado: 'Pendiente' }]);
    setClientes(prev => upsertClienteDesdeCita(prev, {
      cliente: form.cliente,
      telefono: form.telefono,
      servicio: form.servicio,
      fecha: new Date().toISOString().slice(0, 10),
      precio: servicioInfo?.precio,
    }));
  };

  // --- Servicios (CRUD) ---
  const handleAddServicio = (data) => setServicios(prev => [...prev, { id: 's' + Date.now(), veces: 0, ...data }]);
  const handleEditServicio = (id, data) => setServicios(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  const handleDeleteServicio = (id) => setServicios(prev => prev.filter(s => s.id !== id));

  // --- Inventario (CRUD) ---
  const handleAddProducto = (data) => setProductos(prev => [...prev, { id: 'p' + Date.now(), ...data }]);
  const handleEditProducto = (id, data) => setProductos(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  const handleDeleteProducto = (id) => setProductos(prev => prev.filter(p => p.id !== id));

  // --- Ventas de productos: registra la venta y descuenta stock ---
  const handleAddVenta = (venta) => {
    setVentasProductos(prev => [...prev, { id: 'v' + Date.now(), fecha: new Date().toISOString().slice(0, 10), ...venta }]);
    setProductos(prev => prev.map(p => p.id === venta.productoId ? { ...p, stock: Math.max(0, p.stock - venta.cantidad) } : p));
    if (venta.cliente) {
      setClientes(prev => upsertClienteDesdeCita(prev, {
        cliente: venta.cliente,
        telefono: '',
        servicio: venta.producto,
        fecha: new Date().toISOString().slice(0, 10),
        precio: venta.total,
      }));
    }
  };

  return (
    <div className="bd-root flex min-h-screen w-full" style={{ background: C.bg }}>
      <GlobalStyles />
      {showModal && (
        <CitaModal
          servicios={servicios}
          onClose={() => setShowModal(false)}
          onSave={handleGuardarCita}
        />
      )}
      <Sidebar active={active} setActive={setActive} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}
        userName={user?.name} roleLabel={ROLE_LABEL[role]} navItems={navItems} navTienda={navTienda} onLogout={logout} />
      <div className="flex-1 min-w-0">
        <Topbar title={title} subtitle={subtitle} setMobileOpen={setMobileOpen} onNuevaCita={() => setShowModal(true)} />
        <main className="px-5 lg:px-8 py-6 max-w-[1400px]">
          {active === 'dashboard' && <DashboardView onNuevaCita={() => setShowModal(true)} servicios={servicios} />}
          {active === 'agenda' && <AgendaView citas={citas} setCitas={setCitas} />}
          {active === 'clientes' && <ClientesView clientes={clientes} />}
          {active === 'servicios' && (
            <ServiciosView servicios={servicios} onAdd={handleAddServicio} onEdit={handleEditServicio} onDelete={handleDeleteServicio} readOnly={role !== 'owner'} />
          )}
          {active === 'empleados' && role === 'owner' && (
            <EmpleadosView empleados={empleados} onCreate={handleCreateEmpleado} />
          )}
          {active === 'ingresos' && role === 'owner' && <IngresosView servicios={servicios} />}
          {active === 'metricas' && role === 'owner' && <MetricasView servicios={servicios} />}
          {active === 'alertas' && role === 'owner' && <AlertasView />}
          {active === 'inventario' && role === 'owner' && (
            <InventarioView productos={productos} onAdd={handleAddProducto} onEdit={handleEditProducto} onDelete={handleDeleteProducto} />
          )}
          {active === 'ventas' && (
            <VentasView productos={productos} ventas={ventasProductos} onAddVenta={handleAddVenta} />
          )}
        </main>
      </div>
    </div>
  );
}
