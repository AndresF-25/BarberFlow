import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthShell from './AuthShell';

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

    if (form.name.trim().length < 2) return setError('Ingresa tu nombre completo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Ingresa un correo válido.');
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return setError('La contraseña debe tener al menos 8 caracteres, con letras y números.');
    }

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
    <AuthShell
      headline="Tu barbería en línea en una tarde"
      lead="Crea tu cuenta, carga tus servicios y empieza a recibir reservas hoy mismo. Pruébalo 14 días sin tarjeta."
      title="Crea tu cuenta"
      sub="Arma el perfil de tu barbería y empieza a recibir reservas."
      footer={<p className="auth-switch">¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link></p>}
    >
      {error && <div className="auth-error" role="alert">{error}</div>}

      <form onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="name">Nombre completo</label>
          <input id="name" type="text" autoComplete="name" placeholder="Andrés Morales" value={form.name} onChange={onChange('name')} className={error && form.name.trim().length < 2 ? 'has-error' : ''} />
        </div>
        <div>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" placeholder="tu@barberia.com" value={form.email} onChange={onChange('email')} />
        </div>
        <div>
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres, letras y números" value={form.password} onChange={onChange('password')} />
        </div>
        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? 'Creando cuenta…' : 'Crear cuenta gratis'}
        </button>
      </form>
    </AuthShell>
  );
}
