import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        ignores: [
            'node_modules/',
            '.aws-sam/',
            'docs/',
            'tmp/',
            'layers/',
            'docker/',
            'dist/',
            'build/',
            'coverage/',
            'event-samples/',
        ],
    },
    ...tseslint.config({
        files: ['src/**/*.ts', 'scripts/**/*.ts'],
        extends: [...tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
            globals: globals.node,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
            '@typescript-eslint/consistent-type-imports': ['error', {fixStyle: 'separate-type-imports'}],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/require-await': 'warn',
            'no-console': 'warn',
        },
    }),
    {
        files: ['*.mjs', 'scripts/**/*.mjs', 'test/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: globals.node,
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-console': 'warn',
        },
    },
    prettierConfig,
];
