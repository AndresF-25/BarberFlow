import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './auth.css';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.name.trim().length < 2) return setError('Ingresá tu nombre completo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Ingresá un correo válido.');
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');

    setSubmitting(true);
    const result = await register(form);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="barberflow-auth">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <span className="auth-logo-mark"><span /></span>
          <span className="auth-logo-text">BarberFlow</span>
        </Link>

        <p className="auth-eyebrow">Prueba gratis · 14 días</p>
        <h1>Creá tu cuenta</h1>
        <p className="auth-sub">Armá el perfil de tu barbería y empezá a recibir reservas hoy mismo.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={onSubmit} noValidate>
          <div>
            <label htmlFor="name">Nombre completo</label>
            <input id="name" type="text" placeholder="Andrés Morales" value={form.name} onChange={onChange('name')} className={error && form.name.trim().length < 2 ? 'has-error' : ''} />
          </div>
          <div>
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" placeholder="tu@barberia.com" value={form.email} onChange={onChange('email')} />
          </div>
          <div>
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={onChange('password')} />
          </div>
          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'Creando cuenta…' : 'Crear cuenta gratis'}
          </button>
        </form>

        <p className="auth-switch">¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link></p>
        <Link to="/" className="auth-back">← Volver a la página principal</Link>
      </div>
    </div>
  );
}
