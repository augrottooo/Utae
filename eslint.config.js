import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['build/**', 'data/**', 'work/**', 'node_modules/**'] },
  {
    files: ['web/src/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_' }],
      'no-unreachable': 'error',
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [
      'apps/web/src/**/*.{ts,tsx}',
      'apps/web/vite.config.ts',
      'packages/player-bridge/src/**/*.{ts,tsx}',
      'tests/frontend/**/*.{ts,tsx}',
      'vitest.config.ts',
    ],
  })),
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'packages/player-bridge/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/frontend/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
];
