import js from '@eslint/js';
import react from 'eslint-plugin-react';
import globals from 'globals';

const unusedVars = ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^(_|React)$', caughtErrors: 'none' }];

export default [
  { ignores: ['dist', 'node_modules', 'server/node_modules', 'server/prisma'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: '18' } },
    rules: {
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'warn',
      'no-unused-vars': unusedVars,
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['server/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': unusedVars },
  },
];
