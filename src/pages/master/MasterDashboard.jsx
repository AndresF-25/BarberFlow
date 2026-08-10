import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, Users, LogOut, Shield, Search } from 'lucide-react';

/**
 * Panel del rol 'master'. Es independiente del Dashboard operativo de
 * owner/employee: el master no pertenece a un negocio, sino que consulta
 * información global de todos los negocios registrados en BarberFlow.
 *
 * Reutiliza la paleta de marca (carbón + dorado) para mantener identidad
 * visual con el resto de la app, pero es un componente propio y liviano:
 * no depende de Dashboard.jsx.
 */
const C = {
  bg: '#0F0D0B',
  bgSoft: '#141110',
  surface: '#1B1714',
  border: '#2C2620',
  gold: '#C79A5B',
  text: '#F3ECE0',
  textMuted: '#A99A87',
  textFaint: '#6E6255',
};

export default function MasterDashboard() {
  const { user, logout, listAllBusinesses, listAllUsers } = useAuth();
  const [search, setSearch] = useState('');

  const businesses = useMemo(() => listAllBusinesses(), [listAllBusinesses]);
  const users = useMemo(() => listAllUsers(), [listAllUsers]);

  const employeesCountByBusiness = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u.businessId && (u.role === 'employee' || u.role === 'owner')) {
        map[u.businessId] = map[u.businessId] || { owners: 0, employees: 0 };
        if (u.role === 'owner') map[u.businessId].owners += 1;
        if (u.role === 'employee') map[u.businessId].employees += 1;
      }
    });
    return map;
  }, [users]);

  const filteredBusinesses = businesses.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full" style={{ background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="flex items-center gap-4 px-6 lg:px-10 py-5 sticky top-0 z-10" style={{ background: `${C.bg}ee`, backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}` }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${C.gold}` }}>
          <Shield size={16} style={{ color: C.gold }} />
        </div>
        <div>
          <div className="text-base font-semibold leading-none">Panel MASTER</div>
          <div className="text-[11px] mt-1" style={{ color: C.textFaint }}>Vista global de BarberFlow</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs" style={{ color: C.textMuted }}>{user?.name}</span>
          <button onClick={logout} title="Cerrar sesión" className="w-8 h-8 rounded-md flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
            <LogOut size={14} style={{ color: C.textFaint }} />
          </button>
        </div>
      </div>

      <main className="px-6 lg:px-10 py-8 max-w-[1200px] mx-auto space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: C.textFaint }}>
              <Building2 size={15} />
              <span className="text-xs font-medium uppercase tracking-wide">Negocios registrados</span>
            </div>
            <div className="text-2xl font-semibold" style={{ color: C.gold }}>{businesses.length}</div>
          </div>
          <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: C.textFaint }}>
              <Users size={15} />
              <span className="text-xs font-medium uppercase tracking-wide">Usuarios totales</span>
            </div>
            <div className="text-2xl font-semibold" style={{ color: C.gold }}>{users.length}</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Negocios</h2>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <Search size={14} style={{ color: C.textFaint }} />
              <input
                placeholder="Buscar negocio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs outline-none w-48"
                style={{ color: C.text }}
              />
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: C.textFaint, background: C.bgSoft }}>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Propietarios</th>
                  <th className="px-4 py-3 font-medium">Empleados</th>
                </tr>
              </thead>
              <tbody>
                {filteredBusinesses.map((b) => (
                  <tr key={b.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3" style={{ color: C.textFaint }}>{b.id}</td>
                    <td className="px-4 py-3" style={{ color: C.textMuted }}>{employeesCountByBusiness[b.id]?.owners || 0}</td>
                    <td className="px-4 py-3" style={{ color: C.textMuted }}>{employeesCountByBusiness[b.id]?.employees || 0}</td>
                  </tr>
                ))}
                {filteredBusinesses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: C.textFaint }}>
                      No hay negocios registrados todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Usuarios</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: C.textFaint, background: C.bgSoft }}>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Correo</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3" style={{ color: C.textMuted }}>{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full" style={{
                        background: u.role === 'master' ? 'rgba(199,154,91,0.15)' : u.role === 'owner' ? 'rgba(127,160,122,0.15)' : 'rgba(124,151,172,0.15)',
                        color: u.role === 'master' ? C.gold : u.role === 'owner' ? '#7FA07A' : '#7C97AC',
                      }}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: C.textFaint }}>{businesses.find((b) => b.id === u.businessId)?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
