import { useState } from 'react';
import {
  Bell, Search, Plus, LogOut, KeyRound, Store,
} from 'lucide-react';
import { C, INV } from '../theme';
import { ChangePasswordModal } from './ChangePasswordModal';

function Tab({ item, isActive, onClick, tienda }) {
  const Icon = item.icon;
  const on = tienda ? INV.accent : C.ink;
  return (
    <button onClick={onClick} aria-current={isActive ? 'page' : undefined}
      className="bd-tab inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0"
      style={{ background: isActive ? on : 'transparent', color: isActive ? '#fff' : C.textMuted }}>
      <Icon size={15} aria-hidden="true" />
      {item.label}
    </button>
  );
}

export function TopNav({ active, setActive, userName, businessName, roleLabel, navItems, navTienda, onLogout, onNuevaCita, onNegocio }) {
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const initials = (userName || 'Usuario').split(/\s+/).filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U';
  return (
    <>
    {cambiandoClave && <ChangePasswordModal onClose={() => setCambiandoClave(false)} />}
    <header className="sticky top-0 z-30" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-5 h-16">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="bf-pole bf-pole--round w-2.5 h-7 rounded-full" aria-hidden="true" />
            <div className="leading-none min-w-0">
              <span className="bd-display text-xl leading-none">BarberFlow</span>
              {businessName && (onNegocio
                ? <button onClick={onNegocio} title="Perfil de tu barbería" className="hidden sm:block text-xs mt-1 truncate max-w-[12rem] text-left" style={{ color: C.textFaint }}>{businessName}</button>
                : <div className="hidden sm:block text-xs mt-1 truncate max-w-[12rem]" style={{ color: C.textFaint }}>{businessName}</div>)}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-lg flex-1 max-w-[24rem]" style={{ background: C.bgSoft }}>
            <Search size={15} style={{ color: C.textFaint }} aria-hidden="true" />
            <input placeholder="Buscar cliente, cita..." aria-label="Buscar" className="bg-transparent text-sm outline-none w-full" style={{ color: C.text }} />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {onNuevaCita && (
              <button onClick={onNuevaCita} aria-label="Nueva cita" className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
                style={{ background: C.accent, color: C.onAccent }}>
                <Plus size={15} aria-hidden="true" /> <span className="hidden sm:inline">Nueva cita</span>
              </button>
            )}
            <button aria-label="Notificaciones" className="relative w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: C.bgSoft }}>
              <Bell size={16} style={{ color: C.textMuted }} aria-hidden="true" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: C.red }} />
            </button>
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: C.ink, color: '#fff' }} aria-hidden="true">{initials}</div>
              <div className="hidden lg:block leading-tight min-w-0">
                <div className="text-sm font-semibold truncate max-w-[10rem]">{userName || 'Usuario'}</div>
                <div className="text-xs" style={{ color: C.textFaint }}>{roleLabel}</div>
              </div>
              {onNegocio && (
                <button onClick={onNegocio} title="Mi negocio" aria-label="Mi negocio" aria-current={active === 'negocio' ? 'page' : undefined}
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={active === 'negocio' ? { background: C.ink, border: `1px solid ${C.ink}` } : { border: `1px solid ${C.border}` }}>
                  <Store size={15} style={{ color: active === 'negocio' ? '#fff' : C.textMuted }} aria-hidden="true" />
                </button>
              )}
              <button onClick={() => setCambiandoClave(true)} title="Cambiar contraseña" aria-label="Cambiar contraseña" className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
                <KeyRound size={15} style={{ color: C.textMuted }} aria-hidden="true" />
              </button>
              <button onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión" className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
                <LogOut size={15} style={{ color: C.textMuted }} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <nav aria-label="Secciones" className="bd-tabs flex items-center gap-0.5 overflow-x-auto pb-3 -mx-1 px-1">
          {navItems.map(item => (
            <Tab key={item.id} item={item} isActive={active === item.id} onClick={() => setActive(item.id)} />
          ))}
          {navTienda.length > 0 && (
            <>
              <span className="w-px h-5 mx-1.5 flex-shrink-0" style={{ background: C.border }} aria-hidden="true" />
              {navTienda.map(item => (
                <Tab key={item.id} item={item} tienda isActive={active === item.id} onClick={() => setActive(item.id)} />
              ))}
            </>
          )}
        </nav>
      </div>
    </header>
    </>
  );
}

export function PageHead({ title, subtitle }) {
  return (
    <div className="pt-9 pb-7">
      <h1 className="bd-display text-4xl lg:text-5xl leading-none">{title}</h1>
      {subtitle && <p className="mt-3 text-base" style={{ color: C.textMuted }}>{subtitle}</p>}
    </div>
  );
}
