const restrictedSrcSyntax = [
  {
    // NFR1.5: no state shared between requests; a top-level `let` or a
    // mutable export is a module-level store.
    selector: "Program > VariableDeclaration[kind='let']",
    message: 'No module-level mutable state in the app (NFR1.5).',
  },
  {
    selector: "ExportNamedDeclaration > VariableDeclaration[kind='let']",
    message: 'No module-level mutable state in the app (NFR1.5).',
  },
  {
    // NFR5.4: no port or address in the code; both come from the settings.
    selector: 'Literal[value=/:\\d{2,5}(\\/|$)/]',
    message: 'Do not write a port in the app (NFR5.4).',
  },
  {
    selector: 'Literal[value=/https?:\\/\\//]',
    message: 'Do not write an address in the app (NFR5.4).',
  },
];

module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  // Applies to source files; tests may use the local addresses of stand-ins.
  restrictedSrcSyntax,
  ignorePatterns: ['src/lintFixtures/'],
  overrides: [
    {
      // Command-line scripts and the entry point print their result.
      files: ['src/scripts/**', 'src/index.ts', 'scripts/**'],
      rules: { 'no-console': 'off' },
    },
    {
      // Test support code lives under src/testing and may use test-only
      // dependencies.
      files: ['src/**/*.test.ts', 'src/testing/**'],
      rules: { '@backstage/no-undeclared-imports': 'off' },
    },
  ],
});
