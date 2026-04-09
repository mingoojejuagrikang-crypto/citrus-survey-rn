module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:jest/recommended'],
  env: {
    'jest/globals': true,
  },
  plugins: ['jest'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'off',
    '@typescript-eslint/no-shadow': 'error',
    'no-void': 'off',
    'react/no-unstable-nested-components': 'off',
  },
};
