/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        qamar: {
          primary: '#fe9931',
          primaryHover: '#e88722',
          ink: '#4f4335',
          subdued: '#585757',
          bg: '#FCFCFD',
        }
      },
      fontFamily: {
        sans: ['Cairo', 'Inter', 'Almarai', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
