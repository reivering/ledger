import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.ledger/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // Plain-JS test harness files (VS Code extension tests run as CommonJS inside the extension host).
    files: ['**/*.{mjs,cjs}'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', setTimeout: 'readonly', require: 'readonly', exports: 'writable' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  { files: ['**/test/**'], rules: { '@typescript-eslint/no-non-null-assertion': 'off' } },
);
