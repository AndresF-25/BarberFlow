import React from 'react';
import { Link } from 'react-router-dom';
import './auth.css';

/**
 * Marco compartido de Login y Registro: panel de marca con el poste a la
 * izquierda, formulario a la derecha. En móvil el panel se reduce a una franja.
 */
export default function AuthShell({ headline, lead, title, sub, children, footer }) {
  return (
    <div className="barberflow-auth">
      <aside className="auth-aside">
        <Link to="/" className="auth-logo" aria-label="BarberFlow, volver al inicio">
          <span className="auth-logo-pole bf-pole bf-pole--round" aria-hidden="true" />
          <span className="auth-logo-text">BarberFlow</span>
        </Link>
        <div className="auth-aside-copy">
          <p className="auth-headline">{headline}</p>
          <p className="auth-lead">{lead}</p>
        </div>
        <div className="auth-pole bf-pole bf-pole--move bf-pole--round" aria-hidden="true" />
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="auth-sub">{sub}</p>
          {children}
          {footer}
          <Link to="/" className="auth-back">Volver a la página principal</Link>
        </div>
      </main>
    </div>
  );
}
