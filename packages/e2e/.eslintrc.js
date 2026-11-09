module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  ignorePatterns: ['playwright-report/', 'test-results/', 'out/'],
  overrides: [
    {
      // Command-line entries and the helpers they call print their result.
      files: ['src/**', 'bin/**', 'specs/**'],
      rules: { 'no-console': 'off' },
    },
    {
      // Test support code and the Playwright specs may use test-only
      // dependencies.
      files: [
        'src/**/*.test.ts',
        'src/testing/**',
        'specs/**',
        'playwright.config.ts',
      ],
      rules: {
        '@backstage/no-undeclared-imports': 'off',
        '@backstage/no-relative-monorepo-imports': 'off',
      },
    },
  ],
});
