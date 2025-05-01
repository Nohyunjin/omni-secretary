import { next } from '@eslint-config-next/core';
import prettier from 'eslint-plugin-prettier';
import tailwindcss from 'eslint-plugin-tailwindcss';

/** @type {import('eslint').Linter.Config} */
export default [
  next(),
  {
    plugins: {
      tailwindcss,
      prettier,
    },
    rules: {
      'prettier/prettier': 'error',
      'tailwindcss/classnames-order': 'warn',
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    ignores: ['.next/', 'node_modules/', 'public/', 'out/'],
  },
];
