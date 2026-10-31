import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';

/**
 * إعداد ESLint مسطّح (flat config) — ESLint 9.
 * الهدف: كشف الأخطاء الحقيقية (متغيرات غير معرّفة، imports غير مستخدمة، ...) بلا فرض أسلوب.
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'tests-artifacts/**',
      '**/*.min.js'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      // أخطاء حقيقية فقط — لا قواعد أسلوب
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      eqeqeq: ['warn', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn'
    }
  },
  {
    // ملفات React: نحتاج قاعدة "المتغيرات المستخدمة في JSX" حتى لا تُعد المكوّنات غير مستخدمة
    files: ['apps/miniapp/**/*.jsx'],
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off'
    }
  },
  {
    // سكربتات Node (بما فيها .mjs)
    files: ['scripts/**/*.{js,mjs}', '**/*.test.js', 'apps/server/tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest }
    }
  }
];
