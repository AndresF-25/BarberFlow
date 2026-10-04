import { C } from '../theme';

/* =========================================================================
   ESTILOS GLOBALES
   ========================================================================= */
export function GlobalStyles() {
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
