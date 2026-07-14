import globals from "globals";

const commonRules = {
  "constructor-super": "error",
  "for-direction": "error",
  "getter-return": "error",
  "no-async-promise-executor": "error",
  "no-class-assign": "error",
  "no-compare-neg-zero": "error",
  "no-cond-assign": ["error", "except-parens"],
  "no-const-assign": "error",
  "no-constant-binary-expression": "error",
  "no-control-regex": "off",
  "no-debugger": "error",
  "no-dupe-args": "error",
  "no-dupe-class-members": "error",
  "no-dupe-else-if": "error",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-empty-character-class": "error",
  "no-ex-assign": "error",
  "no-extra-boolean-cast": "error",
  "no-fallthrough": "error",
  "no-func-assign": "error",
  "no-import-assign": "error",
  "no-invalid-regexp": "error",
  "no-irregular-whitespace": "error",
  "no-loss-of-precision": "error",
  "no-new-native-nonconstructor": "error",
  "no-obj-calls": "error",
  "no-promise-executor-return": "error",
  "no-prototype-builtins": "error",
  "no-redeclare": "error",
  "no-self-assign": "error",
  "no-setter-return": "error",
  "no-shadow-restricted-names": "error",
  "no-sparse-arrays": "error",
  "no-this-before-super": "error",
  "no-undef": "error",
  "no-unexpected-multiline": "error",
  "no-unmodified-loop-condition": "error",
  "no-unreachable": "error",
  "no-unreachable-loop": "error",
  "no-unsafe-finally": "error",
  "no-unsafe-negation": "error",
  "no-unsafe-optional-chaining": "error",
  "no-unused-labels": "error",
  "no-unused-private-class-members": "error",
  "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
  "no-useless-backreference": "error",
  "no-useless-catch": "error",
  "no-useless-escape": "off",
  "no-with": "error",
  "require-yield": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
  "eqeqeq": ["error", "always"]
};

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "test-results/**",
      "assets/**",
      "github-download-now-*.zip"
    ]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        ...globals.webextensions,
        browser: "readonly",
        chrome: "readonly",
        importScripts: "readonly",
        module: "readonly"
      }
    },
    rules: commonRules
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node
    },
    rules: commonRules
  },
  {
    files: ["tests/**/*.mjs", "scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    },
    rules: commonRules
  }
];
