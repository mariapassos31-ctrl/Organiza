module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mesma paleta do Argos (FJS): vinho da marca + acento turquesa.
        brand: {
          DEFAULT: '#6c2b3e',
          dark: '#521d30',
          accent: '#11d4c4',
        },
        primary: '#2563eb',
        secondary: '#1e40af',
        success: '#16a34a',
        warning: '#ea580c',
        danger: '#dc2626',
        dark: '#1f2937',
        light: '#f9fafb',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      spacing: {
        'safe-bottom': 'max(1rem, env(safe-area-inset-bottom))',
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}
