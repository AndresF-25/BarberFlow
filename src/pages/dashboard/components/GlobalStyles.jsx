import { C } from '../theme';

/* =========================================================================
   ESTILOS GLOBALES DEL PANEL
   Las fuentes (Bricolage Grotesque e Instrument Sans) se cargan en index.html.
   ========================================================================= */
export function GlobalStyles() {
  return (
    <style>{`
      .bd-root { font-family: 'Instrument Sans', system-ui, sans-serif; color: ${C.text}; font-size: 15px; line-height: 1.5; }
      .bd-display { font-family: 'Bricolage Grotesque', 'Instrument Sans', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.02em; }
      .bd-num { font-variant-numeric: tabular-nums; }
      .bd-root :focus-visible { outline: 3px solid ${C.accent}; outline-offset: 2px; }
      .bd-root button { cursor: pointer; }
      .bd-root input::placeholder, .bd-root textarea::placeholder { color: ${C.textFaint}; opacity: .85; }
      .bd-root select, .bd-root input, .bd-root textarea, .bd-root button { font-family: inherit; }
      .bd-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .bd-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      .bd-scroll::-webkit-scrollbar-track { background: transparent; }
      .bd-tabs { scrollbar-width: none; }
      .bd-tabs::-webkit-scrollbar { display: none; }
      .bd-row { transition: background-color .12s ease; }
      .bd-row:hover { background: ${C.surfaceHover}; }
      .bd-tab { transition: background-color .12s ease, color .12s ease; }
      .bd-tab:hover { background: ${C.bgSoft}; color: ${C.text}; }
      .bd-stack > .bd-statline + .bd-statline { border-top: 1px solid ${C.border}; }
      .bd-fade-in { animation: bdFadeIn .2s ease both; }
      @keyframes bdFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .bd-loadbar { position: relative; width: 120px; height: 3px; overflow: hidden; border-radius: 3px; background: ${C.border}; }
      .bd-loadbar::after { content: ''; position: absolute; inset: 0; width: 40%; border-radius: 3px; background: ${C.accent}; animation: bdSweep 1.1s ease-in-out infinite; }
      @keyframes bdSweep { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
      @media (prefers-reduced-motion: reduce) {
        .bd-fade-in, .bd-loadbar::after { animation: none; }
      }
    `}</style>
  );
}
