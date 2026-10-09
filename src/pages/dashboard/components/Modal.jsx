import { cloneElement, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { C, INV } from '../theme';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo accesible común a todos los modales y al cajón lateral del panel.
 *  - role="dialog" + aria-modal + aria-labelledby (el título).
 *  - Escape lo cierra; hacer clic en el fondo también.
 *  - El foco entra al abrirse, se queda dentro (Tab y Mayús+Tab) y vuelve a donde estaba al cerrarse.
 *  - `size`: 'sm' | 'md' (se conservan las clases max-w-sm / max-w-md). `side`: cajón a la derecha.
 *  - `tone="tienda"`: colores de Inventario y Ventas.
 */
export function Modal({ title, onClose, size = 'md', tone, side = false, showClose = false, children }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const anterior = document.activeElement;
    const panel = panelRef.current;
    const enfocables = () => [...panel.querySelectorAll(FOCUSABLE)];
    // El foco entra al primer CAMPO (quien abre «Nuevo cliente» espera escribir); si no hay, al primer elemento enfocable.
    const primerCampo = panel.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    (primerCampo || enfocables()[0] || panel).focus();

    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const lista = enfocables();
      if (lista.length === 0) { e.preventDefault(); return; }
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && (document.activeElement === primero || !panel.contains(document.activeElement))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (document.activeElement === ultimo || !panel.contains(document.activeElement))) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = desbordeAnterior;
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, []);

  const colores = tone === 'tienda'
    ? { background: INV.surface, border: `1px solid ${INV.border}` }
    : { background: C.surface, border: `1px solid ${C.border}` };

  const cabecera = (
    <div className={showClose ? `flex items-center justify-between ${side ? 'mb-6' : 'mb-5'}` : 'mb-2'}>
      <h3 id={titleId} className="bd-display text-base font-semibold">{title}</h3>
      {showClose && (
        <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} style={{ color: C.textMuted }} aria-hidden="true" /></button>
      )}
    </div>
  );

  // Se dibuja en el <body>: dentro de una vista (que anima su entrada y crea su propia capa) la cabecera
  // fija quedaba por encima del diálogo y tapaba el título y el botón de cerrar del cajón.
  return createPortal(
    <div
      className={side ? 'fixed inset-0 z-50 flex justify-end' : 'fixed inset-0 z-50 flex items-center justify-center p-4'}
      style={{ background: C.scrim }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={side
          ? 'w-full max-w-sm h-full p-6 overflow-y-auto bd-scroll bd-fade-in outline-none'
          : `w-full ${size === 'sm' ? 'max-w-sm' : 'max-w-md'} rounded-xl p-6 bd-fade-in outline-none`}
        style={side ? { background: C.surface, borderLeft: `1px solid ${C.border}` } : colores}
        onClick={(e) => e.stopPropagation()}
      >
        {cabecera}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Etiqueta enlazada a su campo: el lector de pantalla anuncia "Nombre del cliente, campo de texto". */
export function Field({ label, children, className }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs" style={{ color: C.textMuted }}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
