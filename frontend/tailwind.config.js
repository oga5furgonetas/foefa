/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* LA RAMPA SALE DEL LOGO, medida sobre el propio archivo:
           cian #14E7D8, azul #0AACD3, fondo #040710. Antes era el naranja que
           trae Tailwind de serie, que no aparece en ninguna parte de la marca:
           el logo y el producto no se parecían en nada.

           El 400 es EL cian del logo y va en el botón principal. Ojo con el
           texto que lleva encima: es tan claro que en blanco da 1,7:1 y no se
           lee — tiene que ser tinta oscura, que da 11:1. Por eso existe
           `--brand-tinta`, con valor FIJO: no puede salir de la rampa `dark`,
           que se invierte en modo día y dejaría texto claro sobre cian claro. */
        brand: {
          /* LA TINTA DEL BOTON DE MARCA, COMO CLASE.
             `text-brand-tinta` se estaba usando en dos botones y no existia:
             Tailwind no generaba nada y el texto se quedaba del color
             heredado —casi blanco— sobre el cian claro. Medido con axe el
             21-09-2026: **1,44:1** en el boton de descargar la extension,
             cuando el minimo legible es 4,5:1. Justo el fallo contra el que
             avisa el comentario de arriba, materializado.
             Fija y sin tema: el boton es cian en los tres. */
          tinta: 'rgb(var(--brand-tinta) / <alpha-value>)',
          200: '#B8F5EE',
          300: '#5FE3D8',
          400: '#14E7D8',
          500: '#0FC2BC',
          600: '#0AACD3',
        },
        /* Carbón neutro (sin sesgo azul), servido por variables CSS: el modo
           claro invierte la rampa en :root (index.css) y TODA la app se
           retematiza sin tocar clases. Estilo Linear/Apple. */
        dark: {
          50: 'rgb(var(--dk-50) / <alpha-value>)',
          100: 'rgb(var(--dk-100) / <alpha-value>)',
          200: 'rgb(var(--dk-200) / <alpha-value>)',
          300: 'rgb(var(--dk-300) / <alpha-value>)',
          400: 'rgb(var(--dk-400) / <alpha-value>)',
          500: 'rgb(var(--dk-500) / <alpha-value>)',
          600: 'rgb(var(--dk-600) / <alpha-value>)',
          700: 'rgb(var(--dk-700) / <alpha-value>)',
          800: 'rgb(var(--dk-800) / <alpha-value>)',
          900: 'rgb(var(--dk-900) / <alpha-value>)',
          950: 'rgb(var(--dk-950) / <alpha-value>)',
        },
        /* COLORES CON SIGNIFICADO DE LA APP DE REPARTO (diseño compacto, 06-11-2026, §3.6 de la especificación).
           Salen de las variables `--r-*` de index.css: noche por defecto y, en los temas día e híbrido, los medidos
           para papel. `marca` es el acento de TEXTO (el cian del logo da 2,2:1 sobre blanco; el relleno de marca
           sigue siendo `bg-brand-500 text-brand-tinta`); `ok` y `peligro` son rellenos (con blanco encima) y
           `*-texto`, su versión para leer; `aviso` es un tinte con su texto; `marca-tinte`, el tinte de marca de las
           píldoras y los chips; `borde`, el borde de control (3,4:1; el `dk-700` da 1,5:1 de día); `enfasis`, el borde
           de énfasis de §3.5 (el campo al escribir: #0E7C77 de día, #14E7D8 de noche; 07-11-2026). */
        ruta: {
          marca: 'rgb(var(--r-marca) / <alpha-value>)',
          'marca-tinte': 'rgb(var(--r-marca-tinte) / <alpha-value>)',
          'marca-tinte-texto': 'rgb(var(--r-marca-tinte-texto) / <alpha-value>)',
          ok: 'rgb(var(--r-ok) / <alpha-value>)',
          'ok-texto': 'rgb(var(--r-ok-texto) / <alpha-value>)',
          peligro: 'rgb(var(--r-peligro) / <alpha-value>)',
          'peligro-texto': 'rgb(var(--r-peligro-texto) / <alpha-value>)',
          aviso: 'rgb(var(--r-aviso) / <alpha-value>)',
          'aviso-texto': 'rgb(var(--r-aviso-texto) / <alpha-value>)',
          borde: 'rgb(var(--r-borde) / <alpha-value>)',
          enfasis: 'rgb(var(--r-enfasis) / <alpha-value>)',
        },
      },
      /* LA LETRA DE LA APP DE REPARTO (diseño compacto, 06-11-2026, §3.1): once tamaños y ninguno más. Cada uno con
         su interlínea y su peso; todos (menos los tres grandes) crecen con `--letra` («Letra más grande», index.css).
         En las pantallas de reparto no va ningún `text-[Npx]`: lo vigila `scripts/check-tokens-ruta.mjs`. */
      fontSize: {
        pie: ['calc(11px * var(--letra, 1))', { lineHeight: '1.28', fontWeight: '500' }],
        sec: ['calc(12px * var(--letra, 1))', { lineHeight: '1.34' }],
        etiqueta: ['calc(12px * var(--letra, 1))', { lineHeight: '1.34', fontWeight: '600' }],
        texto: ['calc(14px * var(--letra, 1))', { lineHeight: '1.43' }],
        boton: ['calc(14px * var(--letra, 1))', { lineHeight: '1.43', fontWeight: '600' }],
        nombre: ['calc(16px * var(--letra, 1))', { lineHeight: '1.375', fontWeight: '600' }],
        campo: ['calc(16px * var(--letra, 1))', { lineHeight: '1.375' }],
        titulo: ['calc(18px * var(--letra, 1))', { lineHeight: '1.34', fontWeight: '700' }],
        cifra: ['calc(24px * var(--letra, 1))', { lineHeight: '1.25', fontWeight: '700' }],
        guia: ['30px', { lineHeight: '34px', fontWeight: '700' }],
        paquete: ['40px', { lineHeight: '44px', fontWeight: '800' }],
      },
      // `min-h-13`: los 52 del botón principal («Entregado», «Es aquí», «Añadir a mi ruta»).
      spacing: { 13: '52px' },
      /* Una sola familia de texto y una de cifras. `display` apunta a la misma
         que `sans` a propósito: el titular se distingue por tamaño y peso, no
         por cambiar de fuente. Dos familias distintas para lo mismo era medio
         del ruido visual.

         `mono` no es para código: es para MATRÍCULAS, IMPORTES Y MÉTRICAS.
         Las cifras de Plex Mono son tabulares y alinean en columna. */
      fontFamily: {
        sans: ['Archivo Variable', 'Archivo', 'system-ui', 'sans-serif'],
        display: ['Archivo Variable', 'Archivo', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.25s ease-out both',
        shimmer: 'shimmer 1.8s linear infinite',
      },
    },
  },
  plugins: [],
}
