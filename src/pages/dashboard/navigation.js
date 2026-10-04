import {
  LayoutDashboard, CalendarDays, Users, Scissors, DollarSign, Bell, UserPlus, Activity, Package, ShoppingBag,
} from 'lucide-react';

/* =========================================================================
   NAVEGACIÓN
   ========================================================================= */
export const NAV = [
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
export const NAV_BY_ROLE = {
  owner: ['dashboard', 'agenda', 'clientes', 'servicios', 'ingresos', 'metricas', 'alertas', 'empleados'],
  employee: ['dashboard', 'agenda', 'clientes', 'servicios'],
};

export const ROLE_LABEL = { owner: 'Propietario', employee: 'Empleado', master: 'Administrador' };

/* Sección separada del core de cortes: inventario y ventas de productos.
   Se muestran en su propio grupo dentro del sidebar, con acento propio. */
export const NAV_TIENDA = [
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'ventas', label: 'Ventas Extra', icon: ShoppingBag },
];

// El employee puede registrar/consultar ventas, pero el inventario (stock,
// costos) queda como función administrativa exclusiva del owner.
export const NAV_TIENDA_BY_ROLE = {
  owner: ['inventario', 'ventas'],
  employee: ['ventas'],
};

export const TITLES = {
  dashboard: ['Panel General', 'Resumen operativo de tu barbería'],
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
