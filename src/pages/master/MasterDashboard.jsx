import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  Building2, Users, LogOut, Search, KeyRound, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { C } from '../dashboard/theme';
import { ROLE_LABEL } from '../dashboard/navigation';
import { fmtFecha } from '../dashboard/dates';
import { GlobalStyles } from '../dashboard/components/GlobalStyles';
import { ChangePasswordModal } from '../dashboard/components/ChangePasswordModal';

/* =========================================================================
   PANEL MASTER (solo lectura): negocios registrados y sus usuarios.
   Los totales son del sistema entero; la búsqueda solo filtra las tablas.
   ========================================================================= */
const COLORES_ROL = {
  master: { background: C.redBg, color: C.red },
  owner: { background: C.accentBg, color: C.accent },
  employee: { background: C.blueBg, color: C.blue },
};

// Fecha del negocio (Bogotá) de un instante ISO, en «7 oct 2026».
const fechaDe = (iso) => fmtFecha(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)));

export default function MasterDashboard() {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState('');
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [datos, setDatos] = useState({ businesses: [], users: [], totalNegocios: 0, totalUsuarios: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Espera 300 ms tras el último carácter antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaActiva(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const cargar = useCallback(async (activo = { current: true }) => {
    setLoading(true);
    setError('');
    try {
      const [bizData, usersData] = await Promise.all([api.masterBusinesses(busquedaActiva), api.masterUsers()]);
      if (!activo.current) return;
      setDatos({
        businesses: bizData.businesses || [],
        users: usersData.users || [],
        totalNegocios: bizData.total ?? (bizData.businesses || []).length,
        totalUsuarios: usersData.total ?? (usersData.users || []).length,
      });
    } catch (err) {
      if (activo.current) setError(err.message || 'No se pudieron cargar los datos.');
    } finally {
      if (activo.current) setLoading(false);
    }
  }, [busquedaActiva]);

  useEffect(() => {
    const activo = { current: true };
    cargar(activo);
    return () => { activo.current = false; };
  }, [cargar]);

  // Con una búsqueda activa, la tabla de usuarios muestra solo a los de los negocios encontrados.
  const usuariosVisibles = useMemo(() => {
    if (!busquedaActiva) return datos.users;
    const ids = new Set(datos.businesses.map((b) => b.id));
    return datos.users.filter((u) => u.businessId && ids.has(u.businessId));
  }, [datos, busquedaActiva]);

  const hayDatos = datos.businesses.length > 0 || datos.users.length > 0;

  return (
    <div className="bd-root min-h-screen w-full" style={{ background: C.bg, color: C.text }}>
      <GlobalStyles />
      {cambiandoClave && <ChangePasswordModal onClose={() => setCambiandoClave(false)} />}
      <header className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.border}` }}>
        <div className="mx-auto max-w-[1200px] flex items-center gap-3 px-6 lg:px-10 h-16">
          <div className="bf-pole bf-pole--round w-2.5 h-7 rounded-full" aria-hidden="true" />
          <span className="bd-display text-xl leading-none">BarberFlow</span>
          <span className="text-sm px-2.5 py-1 rounded-full font-semibold" style={{ background: C.redBg, color: C.red }}>Master</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline text-sm" style={{ color: C.textMuted }}>{user?.name}</span>
            <button onClick={() => setCambiandoClave(true)} title="Cambiar contraseña" aria-label="Cambiar contraseña" className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
              <KeyRound size={15} style={{ color: C.textMuted }} aria-hidden="true" />
            </button>
            <button onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión" className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
              <LogOut size={15} style={{ color: C.textMuted }} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 lg:px-10 py-8 max-w-[1200px] mx-auto space-y-8">
        {loading && (
          <div className="flex items-center gap-3 text-sm" style={{ color: C.textFaint }} role="status">
            <div className="bf-pole bf-pole--move bf-pole--round w-3 h-8 rounded-full" aria-hidden="true" />
            Cargando datos…
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center gap-3 text-sm p-4 rounded-xl" style={{ background: C.redBg, color: C.red }}>
            <AlertTriangle size={16} aria-hidden="true" className="flex-shrink-0" />
            <span className="flex-1">No se pudieron cargar los datos: {error}</span>
            <button onClick={() => cargar()} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.red}` }}>
              <RefreshCw size={12} aria-hidden="true" /> Reintentar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-5" style={{ background: C.bgSoft }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: C.textFaint }}>
              <Building2 size={15} aria-hidden="true" />
              <span className="text-sm font-medium">Negocios registrados</span>
            </div>
            <div className="bd-display bd-num text-5xl">{datos.totalNegocios}</div>
          </div>
          <div className="rounded-xl p-5" style={{ background: C.bgSoft }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: C.textFaint }}>
              <Users size={15} aria-hidden="true" />
              <span className="text-sm font-medium">Usuarios totales</span>
            </div>
            <div className="bd-display bd-num text-5xl">{datos.totalUsuarios}</div>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="bd-display text-2xl">Negocios</h2>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg" style={{ background: C.bgSoft }}>
              <Search size={14} style={{ color: C.textFaint }} aria-hidden="true" />
              <input
                placeholder="Buscar negocio o dueño..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-56" aria-label="Buscar negocio o dueño"
                style={{ color: C.text }}
              />
            </div>
          </div>
          {busquedaActiva && !error && (
            <p className="text-xs mb-2" role="status" style={{ color: C.textFaint }}>
              {datos.businesses.length} de {datos.totalNegocios} {datos.totalNegocios === 1 ? 'negocio' : 'negocios'}
            </p>
          )}

          <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${C.border}`, background: C.surface }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-sm" style={{ color: C.textMuted, background: C.bgSoft }}>
                  <th scope="col" className="px-4 py-3 font-semibold">Negocio</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Propietario</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Empleados</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Registrado</th>
                </tr>
              </thead>
              <tbody>
                {datos.businesses.map((b) => (
                  <tr key={b.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td className="px-4 py-3 font-medium" title={`ID ${b.id}`}>{b.name}</td>
                    <td className="px-4 py-3" style={{ color: C.textMuted }}>
                      {b.owner ? <>{b.owner.name}<div className="text-xs" style={{ color: C.textFaint }}>{b.owner.email}</div></> : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: C.textMuted }}>
                      {b.employees} {b.employees === 1 ? 'activo' : 'activos'}{b.inactiveEmployees > 0 ? ` · ${b.inactiveEmployees} ${b.inactiveEmployees === 1 ? 'desactivado' : 'desactivados'}` : ''}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: C.textMuted }}>{fechaDe(b.createdAt)}</td>
                  </tr>
                ))}
                {datos.businesses.length === 0 && !loading && !error && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: C.textFaint }}>
                      {busquedaActiva ? 'Ningún negocio coincide con la búsqueda.' : 'No hay negocios registrados todavía.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="bd-display text-2xl mb-4">Usuarios</h2>
          <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${C.border}`, background: C.surface }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-sm" style={{ color: C.textMuted, background: C.bgSoft }}>
                  <th scope="col" className="px-4 py-3 font-semibold">Nombre</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Correo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Rol</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Negocio</th>
                </tr>
              </thead>
              <tbody>
                {usuariosVisibles.map((u) => (
                  <tr key={u.id} style={{ borderTop: `1px solid ${C.border}`, opacity: u.active === false ? 0.6 : 1 }}>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3" style={{ color: C.textMuted }}>{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={COLORES_ROL[u.role]}>{ROLE_LABEL[u.role] || u.role}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: u.active === false ? C.red : C.textMuted }}>{u.active === false ? 'Desactivado' : 'Activo'}</td>
                    <td className="px-4 py-3" style={{ color: C.textFaint }}>{u.businessName || '—'}</td>
                  </tr>
                ))}
                {usuariosVisibles.length === 0 && !loading && !error && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: C.textFaint }}>
                      {hayDatos || busquedaActiva ? 'No hay usuarios para mostrar con esta búsqueda.' : 'No hay usuarios todavía.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
