// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/design-system/**/*.{ts,tsx}'],
    rules: {
      // UI must go through repositories, never import the SQL driver directly (CLAUDE.md).
      'no-restricted-imports': ['error', { paths: [{ name: 'expo-sqlite', message: 'Use a repository in src/database.' }] }],
    },
  },
]);
