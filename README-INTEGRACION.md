# BarberFlow — Integración Landing + Auth + Dashboard

## 0. Aviso importante sobre el punto de partida

Pediste que **no se toque tu Dashboard actual**, pero en esta conversación solo
recibí dos archivos: `index.html` y `styles.css` de la Landing. No tengo acceso
al proyecto React donde vive tu Dashboard real, así que no pude "analizar su
estructura actual" como pediste en el punto 1.

Para no dejarte sin nada funcional, construí un **proyecto completo desde cero**
(Vite + React Router) con:
- La Landing migrada 1:1 a componentes React.
- Registro / Login simulados con `localStorage`.
- Rutas públicas y una ruta privada `/dashboard`.
- Un Dashboard de ejemplo (el que generamos antes en esta conversación) como
  **placeholder** en `src/pages/dashboard/Dashboard.jsx`, solo para que el flujo
  completo (Landing → Registro → Login → Dashboard) funcione de punta a punta.

**Para integrarlo con tu Dashboard real**, la tarea se reduce a un solo paso:

1. Copiá los archivos de tu Dashboard actual dentro de `src/pages/dashboard/`
   (podés borrar `Dashboard.jsx`, el placeholder, o dejarlo como referencia).
2. En `src/App.jsx`, cambiá esta línea:
   ```jsx
   import Dashboard from './pages/dashboard/Dashboard';
   ```
   por la ruta a tu componente real (ej. `import Dashboard from './pages/Dashboard';`).
3. Nada más. `ProtectedRoute`, `AuthContext` y las rutas no dependen de lo que
   haya adentro del Dashboard — solo lo envuelven y lo protegen.

Si me pasás los archivos de tu proyecto React actual, puedo hacer esta fusión
por vos en la próxima conversación, archivo por archivo, en vez de este
placeholder.

## 1. Qué se migró de la Landing

Se convirtió `index.html` + `styles.css` a componentes React manteniendo
**exactamente** el mismo diseño: colores, tipografías (Big Shoulders Display +
Inter + Space Mono, cargadas igual que antes), espaciados, layout responsive
y los mismos íconos SVG inline.

Lo único que cambió es *cómo* se logran los mismos efectos, porque el
`script.js` original no fue proporcionado:

| Comportamiento original (script.js, no incluido) | Cómo quedó en React |
|---|---|
| Header con sombra al hacer scroll (`.is-scrolled`) | `useState` + listener de `scroll` |
| Menú móvil (`.nav-open`, `aria-expanded`) | `useState navOpen` en `Landing.jsx` |
| Animación "reveal" al hacer scroll (`.reveal.is-visible`) | `IntersectionObserver` en un `useEffect` |
| Carrusel de testimonios (dots, prev/next) | Array `TESTIMONIOS` + `useState testimonial` (se agregaron 2 testimonios más al que ya tenías, mismo tono, para que el carrusel tenga sentido) |
| Año dinámico en el footer | `new Date().getFullYear()` |
| Formulario de newsletter | `onSubmit` con validación simple de email y mensaje de confirmación |

El CSS (`landing.css`) se generó a partir de tu `styles.css` original, pero
**encapsulado bajo la clase `.barberflow-landing`** (todos los selectores,
incluyendo los que estaban en `:root`, `body`, `html`, y los que están dentro
de los `@media`). Esto es clave: así los estilos de la Landing **no se filtran
ni pisan** los estilos de Login, Registro o tu Dashboard cuando conviven en el
mismo proyecto — que era uno de tus requisitos explícitos.

Los botones que antes eran `<a href="#">` sin destino real ahora usan
`<Link>` de React Router hacia `/registro` o `/login` ("Iniciar sesión",
"Prueba gratis", "Empezar prueba gratis", los tres "Comenzar ahora" de
precios, y el botón del banner final). Los enlaces internos de ancla
(`#funciones`, `#precios`, etc.) se dejaron igual porque siguen funcionando
en una SPA.

## 2. Estructura de archivos

```
barberflow/
├── index.html                     # HTML raíz de Vite
├── package.json
├── vite.config.js
├── tailwind.config.js             # Tailwind solo lo usa el Dashboard placeholder
├── postcss.config.js
└── src/
    ├── main.jsx                   # entry point
    ├── App.jsx                    # rutas: /, /registro, /login, /dashboard
    ├── index.css                  # directivas @tailwind (las usa el Dashboard)
    ├── context/
    │   └── AuthContext.jsx        # registro/login/logout simulados (localStorage)
    ├── routes/
    │   └── ProtectedRoute.jsx     # protege /dashboard, redirige a /login
    └── pages/
        ├── landing/
        │   ├── Landing.jsx        # Landing migrada de HTML/CSS
        │   └── landing.css        # tu CSS original, encapsulado
        ├── auth/
        │   ├── Register.jsx
        │   ├── Login.jsx
        │   └── auth.css           # estilos nuevos, en la misma línea de marca
        └── dashboard/
            └── Dashboard.jsx      # PLACEHOLDER — reemplazar por tu Dashboard real
```

## 3. Autenticación simulada

`AuthContext.jsx` guarda usuarios en `localStorage` bajo la llave
`barberflow_users` (array de `{ name, email, password }`, en texto plano
porque es solo para pruebas) y la sesión activa en `barberflow_session`
(el correo del usuario logueado).

- **Registro**: valida nombre, email y contraseña (mínimo 6 caracteres),
  rechaza correos duplicados, guarda el usuario y lo deja logueado.
- **Login**: busca el usuario por correo y compara la contraseña.
- **Logout**: botón en el sidebar del Dashboard, borra la sesión.
- **Ruta protegida**: `/dashboard` redirige a `/login` si no hay sesión, y
  vuelve a la página que el usuario quería ver después de loguearse.

Está deliberadamente aislado en un solo archivo para que, cuando tengas
backend real, solo tengas que reescribir el cuerpo de `register`, `login` y
`logout` (por llamadas `fetch`/`axios` a tu API) sin tocar el resto de la app.

## 4. Cómo correrlo

```bash
npm install
npm run dev
```

Y para verificar que compila para producción:

```bash
npm run build
```

(Ya lo probé acá: instala y compila sin errores.)

## 5. Siguientes pasos sugeridos

1. Pasame tu Dashboard real para reemplazar el placeholder.
2. Si tu backend ya existe, migramos `AuthContext.jsx` a llamadas HTTP reales.
3. Si querés persistencia real de usuarios (no solo `localStorage`), avisame
   qué backend vas a usar (Node/Express, Supabase, Firebase, etc.) y ajusto
   `AuthContext` a ese contrato.
