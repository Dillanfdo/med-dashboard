/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ink: '#1c1917',
        clinic: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
    },
  },
  plugins: [],
}
