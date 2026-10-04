import {
  Scissors, X, LogOut,
} from 'lucide-react';
import { C, INV } from '../theme';

export function Sidebar({ active, setActive, mobileOpen, setMobileOpen, userName, roleLabel, navItems, navTienda, onLogout }) {
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
