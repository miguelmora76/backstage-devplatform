const restrictedSyntax = [
  {
    // NFR5.5: text from the backend and from users is shown as text, never as markup.
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'Raw-HTML insertion is not allowed in this plugin (NFR5.5).',
  },
  {
    selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
    message: 'Raw-HTML insertion is not allowed in this plugin (NFR5.5).',
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'Raw-HTML insertion is not allowed in this plugin (NFR5.5).',
  },
  {
    // NFR5.11: no port in the code; addresses come from the discovery service.
    selector: 'Literal[value=/:\\d{2,5}(\\/|$)/]',
    message: 'Do not write a port in the plugin (NFR5.11).',
  },
];

module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  rules: {
    'no-restricted-syntax': ['error', ...restrictedSyntax],
    // Calls and storage go through GuardrailsApi and DemoSession only
    // (security design S2, S3; logical components isolation notes).
    'no-restricted-globals': [
      'error',
      { name: 'fetch', message: 'Use GuardrailsApi (NFR5.3).' },
      { name: 'sessionStorage', message: 'Use DemoSession (NFR5.2).' },
      { name: 'localStorage', message: 'Use DemoSession (NFR5.2).' },
    ],
  },
  overrides: [
    {
      // Command-line checks print their result.
      files: ['scripts/**'],
      rules: { 'no-console': 'off' },
    },
    {
      // The two files that own calls and storage, and the plugin file that
      // hands Backstage's fetch API to them.
      files: ['src/api/**', 'src/plugin.tsx'],
      rules: { 'no-restricted-globals': 'off' },
    },
    {
      // Test support code lives under src/testing and may use the test-only
      // dependencies; it is excluded from coverage and from the build.
      files: [
        'src/testing/**',
        'src/e2e/**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      rules: {
        '@backstage/no-undeclared-imports': 'off',
        '@backstage/no-relative-monorepo-imports': 'off',
        'no-restricted-globals': 'off',
        'no-restricted-syntax': 'off',
      },
    },
  ],
});
