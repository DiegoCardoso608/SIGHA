import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2e7d32',
          dark: '#1a5c1a',
          light: '#4caf50',
          bg: '#e8f5e9',
        },
        aula: {
          turma: '#4a7abf',
          outras: '#8ea8d8',
          online: '#7b9ccc',
        },
        status: {
          erro: '#e53935',
          aviso: '#f9a825',
          ok: '#2e7d32',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
