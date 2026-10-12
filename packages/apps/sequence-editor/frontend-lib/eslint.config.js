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


export default baseEslintConfig;
