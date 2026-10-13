module.exports = {
  // The environments the code will run in
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'airbnb',
    'airbnb/hooks',
    'airbnb-typescript',
    'plugin:prettier/recommended',
  ],
  // Specify parser to use for typescript code
  parser: '@typescript-eslint/parser',
  // Configure the parser
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: [
    'react',
    // Enforce react hooks rules
    'react-hooks',
    '@typescript-eslint',
    // Checks for accessibility issues in jsx
    'jsx-a11y',
    'prettier',
  ],
  rules: {
    // Add any custom rules here
    'react/prop-types': 'off', // turn off prop types since we're using Typescript
    '@typescript-eslint/no-var-requires': 'off',
    'no-console': 'off',
    // Optional props on TS function components use default parameters instead
    'react/require-default-props': 'off',
    // Prisma aggregate fields (_count, _sum, ...)
    'no-underscore-dangle': ['error', { allow: ['_count', '_sum', '_avg', '_min', '_max'] }],
  },
  overrides: [
    {
      // Tooling files can import devDependencies
      files: ['*.config.ts', 'prisma/**/*.ts'],
      rules: { 'import/no-extraneous-dependencies': 'off' },
    },
  ],
  // Ignore files in the test directory
  ignorePatterns: [
    '/tests/*',
    '/node_modules/**',
    '/dist/**',
    'webpack.config.js',
    'postcss.config.js',
    '/src/generated/**',
  ],
};
