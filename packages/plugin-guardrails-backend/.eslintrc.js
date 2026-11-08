module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  overrides: [
    {
      // Test support code lives under src/testing and may use the test-only
      // dependencies; it is excluded from coverage and from the build.
      files: ['src/testing/**'],
      rules: { '@backstage/no-undeclared-imports': 'off' },
    },
  ],
});
