import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default [
  {
    // `artifacts/` is gitignored build output and holds a vendored
    // node_modules tree (ci-node-modules) plus a yarn cache. Flat config does
    // not read .gitignore, so without this `eslint .` walks into it and fails
    // on rules those vendored packages reference but this config never defines.
    // It only shows up on machines that have run CI locally.
    ignores: ['dist/**', 'node_modules/**', 'artifacts/**', '*.config.js', 'scripts/**', 'code_examples/**']
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // ===== CRITICAL REACT & PERFORMANCE RULES ONLY =====
      
      // React Hooks Rules - CRITICAL for React functionality (as warnings for dev server)
      'react-hooks/rules-of-hooks': 'warn',           // Prevents hooks from being called conditionally
      'react-hooks/exhaustive-deps': 'warn',          // WARNINGS on missing dependencies (performance)
      
      // React Refresh - CRITICAL for development (but don't block dev server)
      'react-refresh/only-export-components': 'warn', // Warn on fast refresh issues instead of error
      
      // ===== PERFORMANCE & MEMORY LEAKS =====
      
      // Critical performance issues
      'no-case-declarations': 'warn',                // Prevents variable hoisting issues in switch cases
      
      // ===== DISABLED RULES (Too Strict for Development) =====
      
      // Disable overly strict rules that don't affect functionality
      '@typescript-eslint/no-explicit-any': 'off',     // Disabled - too noisy for development
      '@typescript-eslint/no-unused-vars': 'off',     // Disabled - too noisy, use IDE or other tools
      'no-empty-pattern': 'off',                      // Disabled - not critical
      'no-var': 'off',                                // Disabled - not critical for development
      'prefer-const': 'off',                          // Disabled - not critical for development
    },
  },
]
