import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    // These two only guide the React Compiler, which this app does not enable.
    // Client-only state (localStorage, the auth session) is read after mount on
    // purpose so server and first client render match.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  { ignores: ['.next/**', '.netlify/**', '.ui-shots/**', 'node_modules/**', 'next-env.d.ts', 'supabase/functions/**'] },
]

export default config
