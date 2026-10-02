import type { Config } from 'tailwindcss'

// Actions are white; colour is reserved for membership state.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // values live in globals.css so the whole app follows the phone's light or dark setting
        base:  { DEFAULT: 'rgb(var(--base) / <alpha-value>)', panel: 'rgb(var(--base-panel) / <alpha-value>)', raised: 'rgb(var(--base-raised) / <alpha-value>)' },
        ink:   '#0A0A0B',
        inverse: 'rgb(var(--inverse) / <alpha-value>)',
        edge:  { DEFAULT: 'rgb(var(--edge) / <alpha-value>)', soft: 'rgb(var(--edge-soft) / <alpha-value>)' },
        chalk: { DEFAULT: 'rgb(var(--chalk) / <alpha-value>)', dim: 'rgb(var(--chalk-dim) / <alpha-value>)' },
        mute:  'rgb(var(--mute) / <alpha-value>)',
        live:  { DEFAULT: 'rgb(var(--live) / <alpha-value>)', tint: 'rgb(var(--live) / .12)' },
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
        sweep: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } },
        trace: { '0%': { strokeDasharray: '100', strokeDashoffset: '100' }, '100%': { strokeDasharray: '100', strokeDashoffset: '0' } },
        bloom: { '0%': { opacity: '0', transform: 'scale(.6)' }, '100%': { opacity: '.14', transform: 'scale(1)' } },
        pulseOut: { '0%': { opacity: '.5', transform: 'scale(.85)' }, '100%': { opacity: '0', transform: 'scale(1.45)' } },
        cross: { '0%': { opacity: '0' }, '35%': { opacity: '1' }, '100%': { opacity: '0' } },
        lift: { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'none' } },
        nudge: { '0%,100%': { transform: 'none' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        tick: { '0%': { transform: 'scale(.6)' }, '60%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
        trophy: { '0%': { opacity: '0', transform: 'scale(.3) rotate(-18deg)' }, '55%': { opacity: '1', transform: 'scale(1.14) rotate(5deg)' }, '78%': { transform: 'scale(.96) rotate(-2deg)' }, '100%': { opacity: '1', transform: 'none' } },
        ring: { '0%': { opacity: '.55', transform: 'scale(.7)' }, '100%': { opacity: '0', transform: 'scale(2.6)' } },
        slam: { '0%': { opacity: '0', transform: 'scale(1.6)', letterSpacing: '.08em' }, '100%': { opacity: '1', transform: 'none', letterSpacing: '-0.02em' } },
        glow: { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },
      },
      animation: {
        // backwards, not both: a transform held after the entrance would trap every
        // fixed overlay inside the page and slide it under the bottom bar
        rise: 'rise .28s cubic-bezier(.2,.8,.2,1) backwards',
        sweep: 'sweep 1.3s cubic-bezier(.4,0,.2,1) infinite',
        trace: 'trace .5s cubic-bezier(.4,0,.2,1) both',
        draw: 'trace .42s cubic-bezier(.5,0,.2,1) .34s both',
        bloom: 'bloom .7s cubic-bezier(.2,.8,.2,1) both',
        'pulse-out': 'pulseOut 1.6s cubic-bezier(.2,.8,.2,1) .5s infinite',
        cross: 'cross .26s ease-out both',
        'lift-1': 'lift .5s cubic-bezier(.2,.8,.2,1) .62s both',
        'lift-2': 'lift .5s cubic-bezier(.2,.8,.2,1) .72s both',
        'lift-3': 'lift .5s cubic-bezier(.2,.8,.2,1) .84s both',
        nudge: 'nudge .36s cubic-bezier(.36,.07,.19,.97)',
        tick: 'tick .32s cubic-bezier(.2,.8,.2,1)',
        trophy: 'trophy .8s cubic-bezier(.2,.9,.25,1) .1s both',
        ring: 'ring 1.1s cubic-bezier(.2,.8,.2,1) .3s both',
        slam: 'slam .55s cubic-bezier(.2,.9,.25,1) .45s both',
        glow: 'glow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
