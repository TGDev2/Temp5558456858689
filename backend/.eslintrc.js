module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['airbnb-base', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'consistent-return': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'import/prefer-default-export': 'off',
    'max-classes-per-file': 'off',
  },
  overrides: [
    {
      files: ['__tests__/**/*.js', '*.test.js', '*.spec.js'],
      env: {
        jest: true,
      },
      rules: {
        'global-require': 'off',
        'arrow-body-style': 'off',
        'prefer-destructuring': 'off',
      },
    },
  ],
};