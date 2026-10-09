import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthShell from './AuthShell';

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
    if (!form.email.trim()) return setError('Ingresa tu correo.');
    if (!form.password) return setError('Ingresa tu contraseña.');
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
    <AuthShell
      headline="Tu agenda de hoy te está esperando"
      lead="Entra para ver las citas del día, tus clientes y lo que vas a facturar."
      title="Iniciar sesión"
      sub="Ingresa a tu panel para gestionar citas, clientes e ingresos."
      footer={<p className="auth-switch">¿Aún no tienes cuenta? <Link to="/registro">Regístrate gratis</Link></p>}
    >
      {error && <div className="auth-error" role="alert">{error}</div>}

      <form onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" placeholder="tu@barberia.com" value={form.email} onChange={onChange('email')} />
        </div>
        <div>
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" value={form.password} onChange={onChange('password')} />
        </div>
        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>
    </AuthShell>
  );
}
