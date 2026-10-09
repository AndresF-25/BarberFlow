import React from 'react';
import { WifiOff } from 'lucide-react';
import { C, DISPLAY_FONT } from '../pages/dashboard/theme';

/**
 * Pantalla para cuando hay una sesión guardada pero no se pudo comprobar con el servidor
 * (sin conexión, API reiniciándose...). La sesión sigue abierta: basta con reintentar.
 */
export default function SessionUnavailable({ onRetry, retrying }) {
  return (
    <div role="alert" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: C.bg, color: C.text, fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '26rem' }}>
        <WifiOff size={28} style={{ color: C.accent, marginBottom: '1rem' }} aria-hidden="true" />
        <h1 style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: '2rem', lineHeight: 1.1, margin: '0 0 .75rem' }}>
          No pudimos conectar con el servidor
        </h1>
        <p style={{ color: C.textMuted, margin: '0 0 1.5rem', lineHeight: 1.5 }}>
          Tu sesión sigue abierta. Revisa tu conexión e inténtalo de nuevo; también lo haremos solos cuando vuelva internet.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          style={{ padding: '.75rem 1.25rem', border: 0, borderRadius: 10, background: C.accent, color: C.onAccent, font: 'inherit', fontWeight: 600, cursor: retrying ? 'progress' : 'pointer', opacity: retrying ? 0.7 : 1 }}
        >
          {retrying ? 'Reintentando…' : 'Reintentar'}
        </button>
      </div>
    </div>
  );
}
