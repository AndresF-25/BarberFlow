/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
      },
      // Esquinas con jerarquía: controles 10px, bloques 16px, modales 20px.
      borderRadius: {
        md: '6px',
        lg: '10px',
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
};
