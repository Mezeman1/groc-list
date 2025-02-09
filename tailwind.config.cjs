/* eslint-env node */
// const defaultTheme = require('tailwindcss/defaultTheme')
const { iconsPlugin, getIconCollections } = require('@egoist/tailwindcss-icons')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        pink: {
          50: '#FDF8F8',
          100: '#FCF2F2',
          200: '#F9E5E6',
          300: '#F5E2E3',
          400: '#EED3D4',
          500: '#E7C4C5',
          600: '#D4A9AB',
          700: '#C08E90',
          800: '#AB7476',
          900: '#975A5C',
          DEFAULT: '#E7C4C5',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    iconsPlugin({
      // Collections: https://icones.js.org/
      collections: getIconCollections(['mdi']),
    }),
  ],
}
