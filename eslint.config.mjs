import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  {
    rules: {
      // next/font loader calls (e.g. `const _geistSans = Geist({...})`) must
      // be assigned to a module-scope const for Next's font optimizer to
      // pick them up, even when only the CSS side effect (the injected
      // @font-face) is used — respect the leading-underscore convention
      // already used in this codebase to mark that as intentional.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
    },
  },
]

export default eslintConfig
