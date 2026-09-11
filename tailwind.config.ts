import type { Config } from 'tailwindcss'

// Light, high-contrast and quiet. Black carries the actions; colour is reserved
// for membership state so it always means something.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#FFFFFF', raised: '#F7F7F5', sunk: '#F0F0EC' },
        ink:     { DEFAULT: '#0E0E10', soft: '#3C3C43' },
        mute:    '#86868B',
        line:    '#E6E6E3',
        good:    { DEFAULT: '#0F7B3E', tint: '#E8F4ED' },
        warn:    { DEFAULT: '#B45309', tint: '#FBF1E5' },
        alert:   { DEFAULT: '#C0271A', tint: '#FBEAE8' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Helvetica Neue', 'sans-serif'],
        body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { sm: '6px', DEFAULT: '10px', md: '12px', lg: '16px', xl: '20px' },
      letterSpacing: { tightest: '-0.035em' },
      boxShadow: {
        card: '0 1px 2px rgba(14,14,16,.05), 0 1px 1px rgba(14,14,16,.04)',
        lift: '0 8px 24px -6px rgba(14,14,16,.12)',
      },
      keyframes: {
        rise:  { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'none' } },
        pop:   { '0%': { transform: 'scale(.85)', opacity: '0' }, '60%': { transform: 'scale(1.03)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        sweep: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } },
        ring:  { '0%': { transform: 'scale(.95)', opacity: '.5' }, '100%': { transform: 'scale(1.7)', opacity: '0' } },
      },
      animation: {
        rise:  'rise .26s cubic-bezier(.2,.8,.2,1) both',
        pop:   'pop .3s cubic-bezier(.2,1.2,.3,1) both',
        shake: 'shake .45s cubic-bezier(.36,.07,.19,.97) both',
        sweep: 'sweep 1.3s cubic-bezier(.4,0,.2,1) infinite',
        ring:  'ring 1.1s cubic-bezier(.2,.8,.2,1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
