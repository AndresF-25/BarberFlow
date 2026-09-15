import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './auth.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await login(form);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // El master tiene su propio panel; owner/employee van a /dashboard
    // (o a la ruta original si ProtectedRoute los mandó a /login desde ahí).
    if (result.user?.role === 'master') {
      navigate('/master', { replace: true });
      return;
    }
    const redirectTo = location.state?.from?.pathname || '/dashboard';
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="barberflow-auth">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <span className="auth-logo-mark"><span /></span>
          <span className="auth-logo-text">BarberFlow</span>
        </Link>

        <p className="auth-eyebrow">Bienvenido de nuevo</p>
        <h1>Iniciar sesión</h1>
        <p className="auth-sub">Ingresá a tu panel para gestionar citas, clientes e ingresos.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={onSubmit} noValidate>
          <div>
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" placeholder="tu@barberia.com" value={form.email} onChange={onChange('email')} />
          </div>
          <div>
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" placeholder="Tu contraseña" value={form.password} onChange={onChange('password')} />
          </div>
          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="auth-switch">¿Todavía no tenés cuenta? <Link to="/registro">Registrate gratis</Link></p>
        <Link to="/" className="auth-back">← Volver a la página principal</Link>
      </div>
    </div>
  );
}
