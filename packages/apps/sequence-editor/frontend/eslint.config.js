import { globalIgnores } from 'eslint/config';
import baseEslintConfig from '@gen-epix/eslint-config';

// Example of adding a custom rule
// /** @type {import('@typescript-eslint/utils/ts-eslint').FlatConfig.ConfigArray} */
// const rules = eslintConfig.find(c => c.files && c.files.includes('**/*.ts')).rules;
// rules['@stylistic/jsx-sort-props'] = ['error', {
//   ignoreCase: true,
//   callbacksLast: true,
//   shorthandFirst: true,
//   reservedFirst: true,
//   noSortAlphabetically: true,
//   multiline: 'ignore',
// }];


export default [
  ...baseEslintConfig,
  globalIgnores([
    'src/BenchmarkPanel.tsx',
    'src/ScrollingViewport.tsx',
    'src/TestHarness.tsx',
  ]),
  {
    files: ['src/engine/engine.worker.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/require-await': 'off',
      'default-case': 'off',
      'no-useless-assignment': 'off',
      'prefer-arrow/prefer-arrow-functions': 'off',
    },
  },
  {
    files: ['src/engine/protocol.ts'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
    },
  },
];
