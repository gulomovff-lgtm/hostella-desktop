import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

// Линтер настроен на РЕАЛЬНЫЕ ошибки, а не на стиль.
// Что включено как ошибка — то, что ломает приложение в проде:
// необъявленные имена, дубли ключей, нарушенные правила хуков.
// Что предупреждение — то, что стоит посмотреть, но иногда осознанно нарушается.
// Что выключено — правила React-компилятора (react-hooks v7): они рассчитаны на
// переписанный под компилятор код и на этой базе дают сотни ложных срабатываний.
export default defineConfig([
  globalIgnores(['dist', 'release', 'node_modules', 'public', '*.config.js']),

  // ── Интерфейс: браузер + значения, подставляемые Vite ──────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly',   // define в vite.config.js
        __BUILD_TS__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: {
      // Ошибки: ломают приложение
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-irregular-whitespace': 'error',
      'react-hooks/rules-of-hooks': 'error',
      // БЕЗ ЭТОГО ПРАВИЛА no-unused-vars врёт: имя, использованное только в JSX
      // (<motion.div>, <Icon/>), выглядит для него неиспользуемым, и его «мёртвый
      // импорт» на самом деле живой. Один раз уже стоил белого экрана на входе.
      'react/jsx-uses-vars': 'error',
      // И обратная сторона: компонент, использованный в JSX без импорта. Сборка
      // такое пропускает, экран падает уже у кассира.
      'react/jsx-no-undef': 'error',
      // Неиспользуемое: чаще всего след недоделанной правки
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^[A-Z_]',      // константы могут быть «про запас»
        argsIgnorePattern: '^_',           // _event, _unused — намеренно
        caughtErrorsIgnorePattern: '^_|^e$',
        ignoreRestSiblings: true,          // const { pass, ...rest } — приём «выкинуть поле»
      }],
      // Зависимости эффектов: часто нарушаются осознанно (таймеры на refs)
      'react-hooks/exhaustive-deps': 'warn',
      // Пустой catch допустим: «не смогли — не страшно» встречается по делу
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Правила React-компилятора — не для этой кодовой базы
      'react-hooks/static-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },

  // ── Node: главный процесс, облачные функции, тесты, скрипты ────────────────
  {
    files: ['electron/**/*.js', 'functions/**/*.js', 'tests/**/*.mjs', 'scripts/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node },
      parserOptions: { sourceType: 'commonjs' },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_|^e$', ignoreRestSiblings: true }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // Тесты и утилиты — модули ES
  {
    files: ['tests/**/*.mjs'],
    languageOptions: { parserOptions: { sourceType: 'module' } },
  },
])
