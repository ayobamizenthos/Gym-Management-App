import type { Config } from 'tailwindcss'

// Deliberate palette: near-black ground, one high-voltage accent, no gradients.
// Corners stay tight (max 6px) so nothing reads as a soft SaaS card.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    { DEFAULT: '#0B0B0C', soft: '#141417', line: '#26262B', mute: '#8A8A93' },
        paper:  { DEFAULT: '#F4F4F0', dim: '#E3E3DC' },
        volt:   { DEFAULT: '#CCFF00', dark: '#A8D400' },
        alert:  '#FF3B30',
        warn:   '#FFB020',
        good:   '#22C55E',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { none: '0', sm: '2px', DEFAULT: '4px', md: '6px', lg: '8px' },
      letterSpacing: { tightest: '-0.04em' },
      keyframes: {
        'rise':   { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'none' } },
        'pop':    { '0%': { transform: 'scale(.8)', opacity: '0' }, '60%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'shake':  { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-7px)' }, '40%,80%': { transform: 'translateX(7px)' } },
        'sweep':  { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        'ring':   { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.8)', opacity: '0' } },
      },
      animation: {
        rise:  'rise .28s cubic-bezier(.2,.8,.2,1) both',
        pop:   'pop .32s cubic-bezier(.2,1.2,.3,1) both',
        shake: 'shake .5s cubic-bezier(.36,.07,.19,.97) both',
        sweep: 'sweep 1.4s linear infinite',
        ring:  'ring 1.1s cubic-bezier(.2,.8,.2,1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
