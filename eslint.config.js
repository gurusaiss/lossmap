import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'supabase/functions/_shared/core/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended, ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx}'], plugins: { 'react-hooks': reactHooks }, languageOptions: { globals: { ...globals.browser, ...globals.node } }, rules: { ...reactHooks.configs.recommended.rules, 'react-hooks/set-state-in-effect': 'off', // loading data in effects is deliberate here
       '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  { files: ['**/*.mjs'], languageOptions: { globals: { ...globals.node } } },
  { files: ['supabase/functions/**/*.ts'], languageOptions: { globals: { Deno: 'readonly' } } },
);
