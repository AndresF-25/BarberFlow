import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './landing.css';

/**
 * Testimonios mostrados en el carrusel de la sección "Beneficios".
 * El primero conserva el texto original de la landing; se agregaron
 * dos adicionales, en el mismo tono, para que el carrusel tenga sentido.
 */
const TESTIMONIOS = [
  {
    quote: '\u201cDesde que uso BarberFlow, mis reservas subieron un 40% y vendo productos incluso cuando la barber\u00eda est\u00e1 cerrada.\u201d',
    avatar: 'AM',
    name: 'Andr\u00e9s Morales',
    shop: 'Barber\u00eda Premium',
  },
  {
    quote: '\u201cDej\u00e9 de perder turnos por inasistencias. Los recordatorios autom\u00e1ticos me devolvieron horas de silla ocupada cada semana.\u201d',
    avatar: 'JP',
    name: 'Juli\u00e1n Pati\u00f1o',
    shop: 'Barber\u00eda El Fade',
  },
  {
    quote: '\u201cMis clientes agendan desde Instagram sin escribirme. Se siente como tener un recepcionista trabajando 24/7.\u201d',
    avatar: 'RC',
    name: 'Ricardo Cort\u00e9s',
    shop: 'Barber\u00eda Cl\u00e1sica',
  },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [testimonial, setTestimonial] = useState(0);
  const [email, setEmail] = useState('');
  const [newsletterMsg, setNewsletterMsg] = useState('Sin spam, solo contenido de valor para tu barber\u00eda.');
  const rootRef = useRef(null);
  const year = new Date().getFullYear();

  // Sombra del header al hacer scroll (equivalente a .site-header.is-scrolled)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Animaci\u00f3n de "reveal" al entrar en pantalla (equivalente a .reveal.is-visible)
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll('.reveal') || [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterMsg('Ingres\u00e1 un correo v\u00e1lido para suscribirte.');
      return;
    }
    setNewsletterMsg('\u00a1List\u00f3! Te vamos a escribir con novedades para tu barber\u00eda.');
    setEmail('');
  };

  return (
    <div ref={rootRef} className="barberflow-landing">
<header className={`site-header${scrolled ? ' is-scrolled' : ''}${navOpen ? ' nav-open' : ''}`} id="site-header">
  <div className="container header-inner">
    <a href="#inicio" className="logo" aria-label="BarberFlow — inicio">
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="32" height="32">
          <rect x="1" y="1" width="30" height="30" rx="8" fill="#121212"/>
          <g clipPath="url(#poleClip)">
            <rect x="6" y="2" width="20" height="28" fill="url(#poleStripes)"/>
          </g>
          <defs>
            <clipPath id="poleClip"><rect x="6" y="4" width="20" height="24" rx="10"/></clipPath>
            <linearGradient id="poleStripes" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#C9A227"/>
              <stop offset="25%" stopColor="#1F4D3A"/>
              <stop offset="50%" stopColor="#FFD6D1"/>
              <stop offset="75%" stopColor="#C9A227"/>
              <stop offset="100%" stopColor="#1F4D3A"/>
            </linearGradient>
          </defs>
        </svg>
      </span>
      <span className="logo-text">BarberFlow</span>
    </a>

    <nav className="main-nav" id="main-nav">
      <a href="#inicio" onClick={() => setNavOpen(false)}>Inicio</a>
      <a href="#beneficios" onClick={() => setNavOpen(false)}>Beneficios</a>
      <a href="#funciones" onClick={() => setNavOpen(false)}>Funciones</a>
      <a href="#precios" onClick={() => setNavOpen(false)}>Precios</a>
      <a href="#contacto" onClick={() => setNavOpen(false)}>Contacto</a>
    </nav>

    <div className="header-actions">
      <Link to="/login" className="btn btn-ghost btn-small">Iniciar sesión</Link>
      <Link to="/registro" className="btn btn-gold btn-small">Prueba gratis</Link>
      <button className="nav-toggle" id="nav-toggle" aria-label="Abrir menú" aria-expanded={navOpen} onClick={() => setNavOpen(o => !o)}>
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<main>

{/* ============ HERO ============ */}
<section className="hero" id="inicio">
  <div className="hero-fade-bg" aria-hidden="true"></div>
  <div className="container hero-inner">

    <div className="hero-copy">
      <p className="eyebrow eyebrow-light">Plataforma N.º 1 para barberías en Latinoamérica</p>
      <h1 className="hero-title">Tu barbería merece <span className="text-gold">más clientes,</span><br />no más trabajo.</h1>
      <p className="hero-sub">Creá tu marca digital, recibí reservas online y vendé productos de barbería — todo desde una sola plataforma pensada para barberos, no para programadores.</p>

      <div className="hero-ctas">
        <Link to="/registro" className="btn btn-gold btn-large">Empezar prueba gratis · 14 días</Link>
        <a href="#funciones" className="btn btn-outline-light btn-large">Ver cómo funciona</a>
      </div>

      <ul className="trust-row">
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>Sin tarjeta de crédito</li>
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>Listo en 10 minutos</li>
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>Soporte 24/7</li>
      </ul>
    </div>

    <div className="hero-visual" aria-hidden="true">
      <div className="barber-pole">
        <div className="barber-pole-stripes"></div>
        <div className="barber-pole-cap barber-pole-cap-top"></div>
        <div className="barber-pole-cap barber-pole-cap-bottom"></div>
      </div>

      <div className="ticket ticket-stats">
        <div className="ticket-head">
          <span className="ticket-label">Resumen de la semana</span>
          <span className="ticket-tag">EN VIVO</span>
        </div>
        <div className="ticket-perf"></div>
        <div className="ticket-stats-grid">
          <div><strong>128</strong><span>Reservas</span></div>
          <div><strong>$4.68M</strong><span>Ingresos</span></div>
          <div><strong>352</strong><span>Clientes</span></div>
          <div><strong>24</strong><span>Vendidos</span></div>
        </div>
      </div>

      <div className="ticket ticket-appt">
        <div className="ticket-appt-avatar">CG</div>
        <div className="ticket-appt-info">
          <strong>Carlos Gómez</strong>
          <span>Corte + barba · 3:30 PM</span>
        </div>
        <span className="badge badge-confirmed">Confirmado</span>
      </div>
    </div>

  </div>
</section>

{/* ============ PROBLEMA ============ */}
<div className="fade-divider" aria-hidden="true"></div>

<section className="section section-paper" id="problema">
  <div className="container">
    <div className="section-head">
      <p className="eyebrow eyebrow-dark">El problema</p>
      <h2>¿Tu barbería vive solo del <span className="text-pine-underline">boca a boca</span>?</h2>
      <p className="section-sub">Cada semana sin presencia digital es una semana de clientes que terminan agendando con la competencia.</p>
    </div>

    <div className="grid-4 reveal-group">
      <article className="problem-card reveal">
        <span className="problem-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 16 6-6M15 16 9 10"/></svg>
        </span>
        <h3>Clientes que olvidan sus turnos</h3>
        <p>Una silla vacía cada semana por inasistencias que nadie alcanzó a avisar a tiempo.</p>
      </article>

      <article className="problem-card reveal">
        <span className="problem-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/></svg>
        </span>
        <h3>Cero presencia digital</h3>
        <p>Si te buscan en Google o Instagram y no aparecés, ya eligieron otra barbería.</p>
      </article>

      <article className="problem-card reveal">
        <span className="problem-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/><path d="M4 4l16 16" opacity=".0"/></svg>
        </span>
        <h3>Productos sin control</h3>
        <p>Vendés ceras, shampoos y kits, pero no sabés cuánto entra ni qué se está agotando.</p>
      </article>

      <article className="problem-card reveal">
        <span className="problem-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>
        </span>
        <h3>Todo a mano, en papel</h3>
        <p>Agendás en cuadernos y cobrás en efectivo, perdiendo horas que deberían ser de corte.</p>
      </article>
    </div>
  </div>
</section>

<div className="fade-divider fade-divider-reverse" aria-hidden="true"></div>

{/* ============ FUNCIONES ============ */}
<section className="section section-dark" id="funciones">
  <div className="container">
    <div className="section-head">
      <p className="eyebrow eyebrow-light">La plataforma</p>
      <h2 className="text-paper">Todo lo que necesita tu barbería para crecer</h2>
      <p className="section-sub text-paper-muted">Cuatro herramientas, una sola cuenta, cero curva de aprendizaje.</p>
    </div>

    <div className="grid-4 reveal-group">
      <article className="feature-card reveal">
        <span className="feature-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>
        </span>
        <h3>Perfil profesional</h3>
        <p>Tu propia página con marca, servicios, fotos y horarios — lista para tu bio de Instagram.</p>
        <a href="#" className="feature-link">Ver más <span aria-hidden="true">→</span></a>
      </article>

      <article className="feature-card reveal">
        <span className="feature-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9.5 14.5 1.8 1.8L15 12.6"/></svg>
        </span>
        <h3>Reservas inteligentes</h3>
        <p>Agenda automática las 24 horas, con recordatorios que bajan las inasistencias.</p>
        <a href="#" className="feature-link">Ver más <span aria-hidden="true">→</span></a>
      </article>

      <article className="feature-card reveal">
        <span className="feature-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>
        </span>
        <h3>Tienda digital</h3>
        <p>Vendé tus productos y kits de barbería sin manejar un inventario aparte.</p>
        <a href="#" className="feature-link">Ver más <span aria-hidden="true">→</span></a>
      </article>

      <article className="feature-card reveal">
        <span className="feature-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M11 20V4M18 20v-7"/></svg>
        </span>
        <h3>Estadísticas en vivo</h3>
        <p>Mirá ventas, clientes frecuentes y horas pico sin abrir una sola planilla.</p>
        <a href="#" className="feature-link">Ver más <span aria-hidden="true">→</span></a>
      </article>
    </div>
  </div>
</section>

{/* ============ COMO FUNCIONA ============ */}
<section className="section section-paper" id="como-funciona">
  <div className="container">
    <div className="section-head">
      <p className="eyebrow eyebrow-dark">Cómo funciona</p>
      <h2>De cero a tu primera reserva, en una tarde</h2>
    </div>

    <ol className="steps reveal-group">
      <li className="step reveal">
        <span className="step-number">1</span>
        <span className="step-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9 12 3l9 6"/><path d="M5 9v11h14V9"/></svg>
        </span>
        <h3>Creá tu barbería</h3>
        <p>Registrate y armá tu perfil en minutos, sin tarjeta de crédito.</p>
      </li>
      <li className="step reveal">
        <span className="step-number">2</span>
        <span className="step-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
        </span>
        <h3>Personalizá tu estilo</h3>
        <p>Subí tu logo, fotos y servicios con los colores de tu marca.</p>
      </li>
      <li className="step reveal">
        <span className="step-number">3</span>
        <span className="step-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6 15.4 6.4M8.6 13.4l6.8 4.2"/></svg>
        </span>
        <h3>Compartí tu enlace</h3>
        <p>Un solo link para Instagram, WhatsApp y Google.</p>
      </li>
      <li className="step reveal">
        <span className="step-number">4</span>
        <span className="step-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="9" cy="15" r="1.4"/><circle cx="15" cy="15" r="1.4"/></svg>
        </span>
        <h3>Recibí reservas y ventas</h3>
        <p>Gestioná turnos, pagos y stock desde el mismo lugar.</p>
      </li>
    </ol>
  </div>
</section>

{/* ============ BENEFICIOS + TESTIMONIOS ============ */}
<section className="section section-cream" id="beneficios">
  <div className="container benefits-grid">

    <div className="benefits-copy reveal">
      <p className="eyebrow eyebrow-dark">Por qué BarberFlow</p>
      <h2>Más tiempo cortando,<br />menos tiempo administrando.</h2>
      <ul className="checklist">
        <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Más clientes potenciales todos los días</li>
        <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Reservas automáticas las 24 horas</li>
        <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Recordatorios que bajan las inasistencias</li>
        <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Marca profesional desde el día uno</li>
        <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Tienda integrada para vender sin fricción</li>
        <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Métricas claras para crecer con criterio</li>
      </ul>
    </div>

    <div className="testimonial-wrap reveal" id="testimonios">
      <div className="testimonial-card">
        <div className="testimonial-stars" aria-hidden="true">★★★★★</div>
        <p className="testimonial-quote" id="testimonial-quote">{TESTIMONIOS[testimonial].quote}</p>
        <div className="testimonial-person">
          <span className="testimonial-avatar" id="testimonial-avatar">{TESTIMONIOS[testimonial].avatar}</span>
          <div>
            <strong id="testimonial-name">{TESTIMONIOS[testimonial].name}</strong>
            <span id="testimonial-shop">{TESTIMONIOS[testimonial].shop}</span>
          </div>
        </div>
        <div className="testimonial-controls">
          <button id="testimonial-prev" aria-label="Testimonio anterior" onClick={() => setTestimonial(i => (i - 1 + TESTIMONIOS.length) % TESTIMONIOS.length)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div className="testimonial-dots" id="testimonial-dots">
            {TESTIMONIOS.map((t, i) => (
              <button key={t.name} className={i === testimonial ? 'is-active' : ''} aria-label={`Ver testimonio de ${t.name}`} onClick={() => setTestimonial(i)}></button>
            ))}
          </div>
          <button id="testimonial-next" aria-label="Siguiente testimonio" onClick={() => setTestimonial(i => (i + 1) % TESTIMONIOS.length)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
    </div>

  </div>
</section>

{/* ============ PRECIOS ============ */}
<div className="fade-divider" aria-hidden="true"></div>

<section className="section section-dark" id="precios">
  <div className="container">
    <div className="section-head">
      <p className="eyebrow eyebrow-light">Planes</p>
      <h2 className="text-paper">Un plan para cada etapa de tu barbería</h2>
    </div>

    <div className="grid-3 reveal-group pricing-grid">

      <article className="pricing-card reveal">
        <div className="pricing-head">
          <span className="ticket-label">Pase mensual</span>
          <h3>Básico</h3>
          <p>Para barberos independientes</p>
        </div>
        <div className="ticket-perf ticket-perf-dark"></div>
        <div className="pricing-price"><span className="price-amount">$19.900</span><span className="price-period">/mes</span></div>
        <ul className="pricing-features">
          <li>Perfil profesional</li>
          <li>Reservas online</li>
          <li>Recordatorios</li>
          <li>Soporte básico</li>
        </ul>
        <Link to="/registro" className="btn btn-outline-light btn-block">Comenzar ahora</Link>
      </article>

      <article className="pricing-card pricing-card-featured reveal">
        <span className="price-tag">Más popular</span>
        <div className="pricing-head">
          <span className="ticket-label">Pase mensual</span>
          <h3>Profesional</h3>
          <p>Para barberías en crecimiento</p>
        </div>
        <div className="ticket-perf ticket-perf-dark"></div>
        <div className="pricing-price"><span className="price-amount">$39.900</span><span className="price-period">/mes</span></div>
        <ul className="pricing-features">
          <li>Todo lo del plan Básico</li>
          <li>Tienda de productos</li>
          <li>Estadísticas avanzadas</li>
          <li>Soporte prioritario</li>
        </ul>
        <Link to="/registro" className="btn btn-gold btn-block">Comenzar ahora</Link>
      </article>

      <article className="pricing-card reveal">
        <div className="pricing-head">
          <span className="ticket-label">Pase mensual</span>
          <h3>Premium</h3>
          <p>Para equipos y cadenas</p>
        </div>
        <div className="ticket-perf ticket-perf-dark"></div>
        <div className="pricing-price"><span className="price-amount">$69.900</span><span className="price-period">/mes</span></div>
        <ul className="pricing-features">
          <li>Todo lo del plan Profesional</li>
          <li>Múltiples barberos</li>
          <li>Reportes avanzados</li>
          <li>Soporte 24/7</li>
        </ul>
        <Link to="/registro" className="btn btn-outline-light btn-block">Comenzar ahora</Link>
      </article>
    </div>

    <div className="compare-table-wrap reveal">
      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col">Sin BarberFlow</th>
            <th scope="col"></th>
            <th scope="col">Con BarberFlow</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className="cell-x">✗</td><td className="cell-label">Reservas online</td><td className="cell-check">✓</td></tr>
          <tr><td className="cell-x">✗</td><td className="cell-label">Tienda digital</td><td className="cell-check">✓</td></tr>
          <tr><td className="cell-x">✗</td><td className="cell-label">Marca profesional</td><td className="cell-check">✓</td></tr>
          <tr><td className="cell-x">✗</td><td className="cell-label">Estadísticas</td><td className="cell-check">✓</td></tr>
          <tr><td className="cell-x">✗</td><td className="cell-label">Recordatorios</td><td className="cell-check">✓</td></tr>
          <tr><td className="cell-text">Limitado</td><td className="cell-label">Soporte</td><td className="cell-text cell-text-gold">24/7</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

{/* ============ CTA BANNER ============ */}
<section className="cta-banner">
  <div className="cta-stripes" aria-hidden="true"></div>
  <div className="container cta-inner">
    <h2>La próxima barbería que se vuelva el lugar de moda en tu ciudad… <span className="text-gold">podría ser la tuya.</span></h2>
    <p>Empezá hoy y convertí tu talento en una marca digital rentable.</p>
    <Link to="/registro" className="btn btn-gold btn-large">Comenzar ahora — gratis por 14 días</Link>
    <p className="cta-fine">Sin tarjeta de crédito · Cancelá cuando quieras</p>
  </div>
</section>

</main>

{/* ============ FOOTER ============ */}
<footer className="site-footer" id="contacto">
  <div className="container footer-top">
    <h2>¿Listo para llevar tu barbería al siguiente nivel?</h2>

    <div className="footer-grid">
      <div className="footer-col footer-brand">
        <a href="#inicio" className="logo logo-footer">
          <span className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <rect x="1" y="1" width="30" height="30" rx="8" fill="#F5F2E8"/>
              <rect x="6" y="4" width="20" height="24" rx="10" fill="url(#poleStripes2)"/>
              <defs>
                <linearGradient id="poleStripes2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#C9A227"/>
                  <stop offset="35%" stopColor="#1F4D3A"/>
                  <stop offset="70%" stopColor="#C9A227"/>
                  <stop offset="100%" stopColor="#1F4D3A"/>
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span className="logo-text">BarberFlow</span>
        </a>
        <p>La plataforma digital hecha para barberos.</p>
        <div className="social-row">
          <a href="#" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg></a>
          <a href="#" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg></a>
          <a href="#" aria-label="WhatsApp"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.7 14.2c-.2.7-1.4 1.4-2 1.5-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .5 0 .7.5.3.6.9 2.1 1 2.3.1.2.1.4 0 .6-.4.8-.9 1-.6 1.5.9 1.6 1.7 2.2 3.1 2.9.2.1.4.1.6-.1.3-.3.7-.9 1-1.2.2-.2.4-.3.7-.2.3.1 1.7.8 2 1 .3.1.5.2.5.4.1.2.1.7-.1 1Z"/></svg></a>
        </div>
      </div>

      <div className="footer-col">
        <h4>Producto</h4>
        <a href="#beneficios">Beneficios</a>
        <a href="#funciones">Funciones</a>
        <a href="#precios">Precios</a>
      </div>

      <div className="footer-col">
        <h4>Contacto</h4>
        <a href="mailto:hola@barberflow.com">hola@barberflow.com</a>
        <a href="tel:+573001234567">+57 300 123 4567</a>
      </div>

      <div className="footer-col footer-newsletter">
        <h4>Recibí tips y novedades</h4>
        <form id="newsletter-form" noValidate onSubmit={handleNewsletterSubmit}>
          <input type="email" name="email" placeholder="Tu correo electrónico" required aria-label="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" aria-label="Suscribirme">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </form>
        <p className="footer-fine" id="newsletter-msg">{newsletterMsg}</p>
      </div>
    </div>
  </div>

  <div className="footer-bottom">
    <div className="container footer-bottom-inner">
      <span>© <span id="year">{year}</span> BarberFlow. Todos los derechos reservados.</span>
      <div className="footer-legal">
        <a href="#">Términos y condiciones</a>
        <a href="#">Política de privacidad</a>
      </div>
    </div>
  </div>
</footer>

    </div>
  );
}
