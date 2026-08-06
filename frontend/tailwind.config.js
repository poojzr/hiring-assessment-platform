/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef0f2',
          100: '#dde1e6',
          200: '#bbc3cd',
          300: '#99a5b4',
          400: '#77879b',
          500: '#556982',
          600: '#445468',
          700: '#333f4e',
          800: '#222a34',
          900: '#11151a',
        },
        accent: {
          50: '#e6f7f3',
          100: '#ccefe7',
          200: '#99dfcf',
          300: '#66cfb7',
          400: '#33bf9f',
          500: '#00af87',
          600: '#008c6c',
          700: '#006951',
          800: '#004636',
          900: '#00231b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  
  safelist: [],
}