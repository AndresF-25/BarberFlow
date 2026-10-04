import {
  Bell, Menu, Search, Plus,
} from 'lucide-react';
import { C } from '../theme';

export function Topbar({ title, subtitle, setMobileOpen, onNuevaCita }) {
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
