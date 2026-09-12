import type { Config } from 'tailwindcss'

// Dark, photographic, high contrast. White carries the actions; colour is only
// ever membership state, so a red or amber on screen always means something.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:  { DEFAULT: '#0A0A0B', panel: '#141417', raised: '#1C1C21' },
        ink:   '#0A0A0B',
        edge:  { DEFAULT: '#2A2A31', soft: '#1F1F25' },
        chalk: { DEFAULT: '#F6F6F3', dim: '#C9C9CE' },
        mute:  '#8A8A93',
        live:  { DEFAULT: '#35D07F', tint: 'rgba(53,208,127,.12)' },
        due:   { DEFAULT: '#FFB020', tint: 'rgba(255,176,32,.12)' },
        out:   { DEFAULT: '#FF453A', tint: 'rgba(255,69,58,.12)', deep: '#D1281E' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { sm: '8px', DEFAULT: '12px', md: '14px', lg: '18px', xl: '24px' },
      letterSpacing: { tightest: '-0.02em' },
      boxShadow: { lift: '0 18px 40px -18px rgba(0,0,0,.75)' },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'none' } },
        pop: { '0%': { transform: 'scale(.85)', opacity: '0' }, '60%': { transform: 'scale(1.03)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        sweep: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } },
        ring: { '0%': { transform: 'scale(.95)', opacity: '.5' }, '100%': { transform: 'scale(1.7)', opacity: '0' } },
        // a workspace switch: the old one leaves the way the finger went
        wipeLeft: { '0%': { transform: 'translate3d(100%,0,0)' }, '45%': { transform: 'translate3d(0,0,0)' }, '100%': { transform: 'translate3d(-100%,0,0)' } },
        wipeRight: { '0%': { transform: 'translate3d(-100%,0,0)' }, '45%': { transform: 'translate3d(0,0,0)' }, '100%': { transform: 'translate3d(100%,0,0)' } },
      },
      animation: {
        rise: 'rise .28s cubic-bezier(.2,.8,.2,1) both',
        pop: 'pop .3s cubic-bezier(.2,1.2,.3,1) both',
        shake: 'shake .45s cubic-bezier(.36,.07,.19,.97) both',
        sweep: 'sweep 1.3s cubic-bezier(.4,0,.2,1) infinite',
        ring: 'ring 1.1s cubic-bezier(.2,.8,.2,1) infinite',
        'wipe-left': 'wipeLeft .6s cubic-bezier(.4,0,.2,1) both',
        'wipe-right': 'wipeRight .6s cubic-bezier(.4,0,.2,1) both',
      },
    },
  },
  plugins: [],
} satisfies Config
