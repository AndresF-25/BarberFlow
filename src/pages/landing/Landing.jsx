import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './landing.css';

const TESTIMONIOS = [
  {
    quote: 'Desde que uso BarberFlow, mis reservas subieron un 40% y vendo productos incluso cuando la barbería está cerrada.',
    avatar: 'AM',
    name: 'Andrés Morales',
    shop: 'Barbería Premium',
  },
  {
    quote: 'Dejé de perder turnos por inasistencias. Los recordatorios automáticos me devolvieron horas de silla ocupada cada semana.',
    avatar: 'JP',
    name: 'Julián Patiño',
    shop: 'Barbería El Fade',
  },
  {
    quote: 'Mis clientes agendan desde Instagram sin escribirme. Se siente como tener un recepcionista trabajando 24/7.',
    avatar: 'RC',
    name: 'Ricardo Cortés',
    shop: 'Barbería Clásica',
  },
];

// Agenda de ejemplo que se muestra en el hero (datos ilustrativos).
const AGENDA = [
  { hora: '9:00', cliente: 'Carlos Gómez', servicio: 'Corte y barba', precio: '$45.000', estado: 'Finalizada' },
  { hora: '9:45', cliente: 'Julián Patiño', servicio: 'Fade clásico', precio: '$30.000', estado: 'Confirmada' },
  { hora: '10:30', cliente: 'Ricardo Cortés', servicio: 'Barba', precio: '$25.000', estado: 'Pendiente' },
];

const PROBLEMAS = [
  { titulo: 'Clientes que olvidan su turno', texto: 'Una silla vacía cada semana por inasistencias que nadie alcanzó a avisar a tiempo.' },
  { titulo: 'Cero presencia digital', texto: 'Si te buscan en Google o Instagram y no apareces, ya eligieron otra barbería.' },
  { titulo: 'Productos sin control', texto: 'Vendes ceras, shampoos y kits, pero no sabes cuánto entra ni qué se está agotando.' },
  { titulo: 'Todo a mano, en papel', texto: 'Agendas en cuadernos y cobras en efectivo, perdiendo horas que deberían ser de corte.' },
];

const FUNCIONES = [
  {
    titulo: 'Perfil profesional',
    texto: 'Tu propia página con marca, servicios, fotos y horarios, lista para la bio de Instagram.',
    icono: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  },
  {
    titulo: 'Reservas inteligentes',
    texto: 'Agenda automática las 24 horas, con recordatorios que bajan las inasistencias.',
    icono: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="m9.5 14.5 1.8 1.8L15 12.6" /></>,
  },
  {
    titulo: 'Tienda digital',
    texto: 'Vende tus productos y kits de barbería sin manejar un inventario aparte.',
    icono: <><path d="M6 7h12l1 13H5L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
  },
  {
    titulo: 'Estadísticas en vivo',
    texto: 'Mira ventas, clientes frecuentes y horas pico sin abrir una sola planilla.',
    icono: <path d="M4 20V10M11 20V4M18 20v-7" />,
  },
];

const PASOS = [
  { titulo: 'Crea tu barbería', texto: 'Regístrate y arma tu perfil en minutos, sin tarjeta de crédito.' },
  { titulo: 'Personaliza tu estilo', texto: 'Sube tu logo, fotos y servicios con los colores de tu marca.' },
  { titulo: 'Comparte tu enlace', texto: 'Un solo link para Instagram, WhatsApp y Google.' },
  { titulo: 'Recibe reservas y ventas', texto: 'Gestiona turnos, pagos y stock desde el mismo lugar.' },
];

const BENEFICIOS = [
  'Más clientes potenciales todos los días',
  'Reservas automáticas las 24 horas',
  'Recordatorios que bajan las inasistencias',
  'Marca profesional desde el día uno',
  'Tienda integrada para vender sin fricción',
  'Métricas claras para crecer con criterio',
];

const PLANES = [
  {
    nombre: 'Básico', para: 'Para barberos independientes', precio: '$19.900',
    items: ['Perfil profesional', 'Reservas online', 'Recordatorios', 'Soporte básico'],
  },
  {
    nombre: 'Profesional', para: 'Para barberías en crecimiento', precio: '$39.900', destacado: true,
    items: ['Todo lo del plan Básico', 'Tienda de productos', 'Estadísticas avanzadas', 'Soporte prioritario'],
  },
  {
    nombre: 'Premium', para: 'Para equipos y cadenas', precio: '$69.900',
    items: ['Todo lo del plan Profesional', 'Múltiples barberos', 'Reportes avanzados', 'Soporte 24/7'],
  },
];

const COMPARATIVA = [
  ['Reservas online', true], ['Tienda digital', true], ['Marca profesional', true],
  ['Estadísticas', true], ['Recordatorios', true],
];

const Icono = ({ children, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const Check = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [testimonial, setTestimonial] = useState(0);
  const [email, setEmail] = useState('');
  const [newsletterMsg, setNewsletterMsg] = useState('Sin spam, solo contenido útil para tu barbería.');
  const year = new Date().getFullYear();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterMsg('Ingresa un correo válido para suscribirte.');
      return;
    }
    setNewsletterMsg('¡Listo! Te escribiremos con novedades para tu barbería.');
    setEmail('');
  };

  const t = TESTIMONIOS[testimonial];
  const cerrarNav = () => setNavOpen(false);

  return (
    <div className="barberflow-landing">
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}${navOpen ? ' nav-open' : ''}`}>
        <div className="container header-inner">
          <a href="#inicio" className="logo" aria-label="BarberFlow, inicio">
            <span className="logo-pole bf-pole bf-pole--round" aria-hidden="true" />
            <span className="logo-text">BarberFlow</span>
          </a>

          <nav className="main-nav" aria-label="Principal">
            <a href="#problema" onClick={cerrarNav}>El problema</a>
            <a href="#funciones" onClick={cerrarNav}>Funciones</a>
            <a href="#beneficios" onClick={cerrarNav}>Beneficios</a>
            <a href="#precios" onClick={cerrarNav}>Precios</a>
            <a href="#contacto" onClick={cerrarNav}>Contacto</a>
          </nav>

          <div className="header-actions">
            <Link to="/login" className="btn btn-quiet btn-small">Iniciar sesión</Link>
            <Link to="/registro" className="btn btn-primary btn-small">Prueba gratis</Link>
            <button className="nav-toggle" aria-label="Abrir menú" aria-expanded={navOpen} onClick={() => setNavOpen(o => !o)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ============ HERO ============ */}
        <section className="hero" id="inicio">
          <div className="container hero-inner">
            <div className="hero-copy">
              <h1 className="hero-title">Más clientes en la silla. Menos papeleo.</h1>
              <p className="hero-sub">
                BarberFlow reúne tus reservas, tu tienda y tus números en un solo panel.
                Tus clientes agendan desde Instagram; tú sigues cortando.
              </p>
              <div className="hero-ctas">
                <Link to="/registro" className="btn btn-primary btn-large">Probar 14 días gratis</Link>
                <a href="#funciones" className="btn btn-line btn-large">Ver cómo funciona</a>
              </div>
              <ul className="trust-row">
                <li><Check size={16} />No pedimos tarjeta</li>
                <li><Check size={16} />Listo en 10 minutos</li>
                <li><Check size={16} />Soporte 24/7</li>
              </ul>
            </div>

            <div className="hero-visual">
              <div className="hero-pole bf-pole bf-pole--move bf-pole--round" aria-hidden="true" />
              <div className="ledger" role="img" aria-label="Ejemplo de agenda del día en BarberFlow">
                <div className="ledger-head">
                  <strong>Agenda de hoy</strong>
                  <span>$100.000 en 3 citas</span>
                </div>
                <ul className="ledger-list">
                  {AGENDA.map((c) => (
                    <li key={c.hora} className="ledger-row">
                      <span className="ledger-time">{c.hora}</span>
                      <span className="ledger-main">
                        <strong>{c.cliente}</strong>
                        <span className="ledger-leader" aria-hidden="true" />
                        <span className="ledger-price">{c.precio}</span>
                      </span>
                      <span className="ledger-service">{c.servicio}</span>
                      <span className={`ledger-state ledger-state-${c.estado.toLowerCase()}`}>{c.estado}</span>
                    </li>
                  ))}
                  <li className="ledger-row ledger-free">
                    <span className="ledger-time">11:15</span>
                    <span className="ledger-main"><strong>Horario libre</strong></span>
                    <span className="ledger-service">Se puede reservar online</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============ PROBLEMA ============ */}
        <section className="section section-white" id="problema">
          <div className="container split">
            <div className="split-head">
              <h2>Cada turno que se pierde es plata que no entra</h2>
              <p className="lead">Cada semana sin presencia digital es una semana de clientes que terminan agendando con la competencia.</p>
            </div>
            <ul className="rows">
              {PROBLEMAS.map((p) => (
                <li key={p.titulo} className="row">
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ============ FUNCIONES ============ */}
        <section className="section section-ink" id="funciones">
          <div className="container">
            <div className="section-head">
              <h2>Todo lo que necesita tu barbería para crecer</h2>
              <p className="lead">Cuatro herramientas, una sola cuenta, cero curva de aprendizaje.</p>
            </div>
            <div className="features">
              {FUNCIONES.map((f) => (
                <article key={f.titulo} className="feature">
                  <span className="feature-icon"><Icono>{f.icono}</Icono></span>
                  <h3>{f.titulo}</h3>
                  <p>{f.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============ CÓMO FUNCIONA ============ */}
        <section className="section section-paper" id="como-funciona">
          <div className="container">
            <div className="section-head">
              <h2>De cero a tu primera reserva, en una tarde</h2>
            </div>
            <ol className="steps">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="step">
                  <span className="step-number">{i + 1}</span>
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============ BENEFICIOS + TESTIMONIO ============ */}
        <section className="section section-white" id="beneficios">
          <div className="container benefits-grid">
            <div className="benefits-copy">
              <h2>Más tiempo cortando, menos tiempo administrando</h2>
              <ul className="checklist">
                {BENEFICIOS.map((b) => (
                  <li key={b}><Check />{b}</li>
                ))}
              </ul>
            </div>

            <figure className="testimonial" id="testimonios">
              <blockquote>
                <p>{t.quote}</p>
              </blockquote>
              <figcaption>
                <span className="testimonial-avatar" aria-hidden="true">{t.avatar}</span>
                <span>
                  <strong>{t.name}</strong>
                  <span>{t.shop}</span>
                </span>
              </figcaption>
              <div className="testimonial-controls">
                <button aria-label="Testimonio anterior" onClick={() => setTestimonial(i => (i - 1 + TESTIMONIOS.length) % TESTIMONIOS.length)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <div className="testimonial-dots">
                  {TESTIMONIOS.map((x, i) => (
                    <button key={x.name} className={i === testimonial ? 'is-active' : ''} aria-label={`Ver testimonio de ${x.name}`} aria-current={i === testimonial} onClick={() => setTestimonial(i)} />
                  ))}
                </div>
                <button aria-label="Siguiente testimonio" onClick={() => setTestimonial(i => (i + 1) % TESTIMONIOS.length)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            </figure>
          </div>
        </section>

        {/* ============ PRECIOS ============ */}
        <section className="section section-paper" id="precios">
          <div className="container">
            <div className="section-head">
              <h2>Un plan para cada etapa de tu barbería</h2>
              <p className="lead">Todos los planes empiezan con 14 días de prueba.</p>
            </div>

            <div className="plans">
              {PLANES.map((p) => (
                <article key={p.nombre} className={`plan${p.destacado ? ' plan-featured' : ''}`}>
                  {p.destacado && <span className="plan-flag">Más elegido</span>}
                  <h3>{p.nombre}</h3>
                  <p className="plan-for">{p.para}</p>
                  <p className="plan-price"><span className="plan-amount">{p.precio}</span><span className="plan-period">al mes</span></p>
                  <ul className="plan-items">
                    {p.items.map((it) => <li key={it}><Check size={16} />{it}</li>)}
                  </ul>
                  <Link to="/registro" className={`btn btn-block ${p.destacado ? 'btn-light' : 'btn-primary'}`}>Comenzar ahora</Link>
                </article>
              ))}
            </div>

            <table className="compare">
              <caption>Con y sin BarberFlow</caption>
              <thead>
                <tr><th scope="col">Qué incluye</th><th scope="col">Sin BarberFlow</th><th scope="col">Con BarberFlow</th></tr>
              </thead>
              <tbody>
                {COMPARATIVA.map(([nombre]) => (
                  <tr key={nombre}>
                    <th scope="row">{nombre}</th>
                    <td className="cell-no">No</td>
                    <td className="cell-yes"><Check size={16} />Sí</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">Soporte</th>
                  <td className="cell-no">Limitado</td>
                  <td className="cell-yes"><Check size={16} />24/7</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="cta">
          <div className="cta-band bf-pole" aria-hidden="true" />
          <div className="container cta-inner">
            <h2>La próxima barbería de moda en tu ciudad podría ser la tuya</h2>
            <p>Empieza hoy y convierte tu talento en una marca digital rentable.</p>
            <Link to="/registro" className="btn btn-light btn-large">Comenzar gratis por 14 días</Link>
            <p className="cta-fine">Sin tarjeta de crédito. Cancela cuando quieras.</p>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="site-footer" id="contacto">
        <div className="container footer-grid">
          <div className="footer-brand">
            <a href="#inicio" className="logo logo-footer" aria-label="BarberFlow, inicio">
              <span className="logo-pole bf-pole bf-pole--round" aria-hidden="true" />
              <span className="logo-text">BarberFlow</span>
            </a>
            <p>La plataforma digital hecha para barberos.</p>
          </div>

          <nav className="footer-col" aria-label="Producto">
            <h4>Producto</h4>
            <a href="#beneficios">Beneficios</a>
            <a href="#funciones">Funciones</a>
            <a href="#precios">Precios</a>
          </nav>

          <div className="footer-col">
            <h4>Contacto</h4>
            <a href="mailto:hola@barberflow.com">hola@barberflow.com</a>
            <a href="tel:+573001234567">+57 300 123 4567</a>
          </div>

          <div className="footer-col footer-newsletter">
            <h4>Recibe tips y novedades</h4>
            <form noValidate onSubmit={handleNewsletterSubmit}>
              <input type="email" name="email" placeholder="Tu correo electrónico" required aria-label="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit">Suscribirme</button>
            </form>
            <p className="footer-fine" role="status">{newsletterMsg}</p>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="container footer-bottom-inner">
            <span>© {year} BarberFlow. Todos los derechos reservados.</span>
            <div className="footer-legal">
              <a href="#contacto">Términos y condiciones</a>
              <a href="#contacto">Política de privacidad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
