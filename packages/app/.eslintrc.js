const restrictedSyntax = [
  {
    // NFR5.5: text from the backend is shown as text, never as markup.
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'Raw-HTML insertion is not allowed in the app (NFR5.5).',
  },
  {
    selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
    message: 'Raw-HTML insertion is not allowed in the app (NFR5.5).',
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'Raw-HTML insertion is not allowed in the app (NFR5.5).',
  },
  {
    // NFR1.5: no module-level mutable state.
    selector: "Program > VariableDeclaration[kind='let']",
    message: 'No module-level mutable state in the app (NFR1.5).',
  },
  {
    // NFR5.4: no port or address in the code.
    selector: 'Literal[value=/:\\d{2,5}(\\/|$)/]',
    message: 'Do not write a port in the app (NFR5.4).',
  },
  {
    selector: 'Literal[value=/https?:\\/\\//]',
    message: 'Do not write an address in the app (NFR5.4).',
  },
];

module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  ignorePatterns: ['src/lintFixtures/'],
  rules: {
    'no-restricted-syntax': ['error', ...restrictedSyntax],
    // NFR1.9: the frontend writes nothing to the console.
    'no-console': 'error',
    // NFR5.3: the token is never stored; storage is not used at all.
    'no-restricted-globals': [
      'error',
      {
        name: 'sessionStorage',
        message: 'The sign-in is held in memory only (NFR5.3).',
      },
      {
        name: 'localStorage',
        message: 'The sign-in is held in memory only (NFR5.3).',
      },
    ],
  },
  overrides: [
    {
      files: ['scripts/**'],
      rules: { 'no-console': 'off' },
    },
    {
      files: [
        'src/testing/**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/setupTests.ts',
      ],
      rules: {
        '@backstage/no-undeclared-imports': 'off',
        '@backstage/no-relative-monorepo-imports': 'off',
        'no-restricted-globals': 'off',
        'no-restricted-syntax': 'off',
        'no-console': 'off',
      },
    },
  ],
});
