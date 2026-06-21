// @ts-check
import globals from "globals";
import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import stylisticPlugin from "@stylistic/eslint-plugin";
import perfectionistPlugin from "eslint-plugin-perfectionist";
import unusedImportsPlugin from "eslint-plugin-unused-imports";

// ----------------------------------------------------------------------

/**
 * @rules common
 */
const commonRules = () => ({
  "no-shadow": 2,
  "func-names": 1,
  "no-bitwise": 2,
  "object-shorthand": 1,
  "no-useless-rename": 1,
  "default-case-last": 2,
  "consistent-return": 2,
  "no-constant-condition": 1,
  "no-unused-vars": 0,
  "default-case": [2, { commentPattern: "^no default$" }],
  "lines-around-directive": [2, { before: "always", after: "always" }],
});

/**
 * @rules import
 * from "eslint-plugin-import".
 */
const importRules = () => ({
  ...importPlugin.configs.recommended.rules,
  "import/named": 0,
  "import/export": 0,
  "import/default": 0,
  "import/namespace": 0,
  "import/no-named-as-default": 0,
  "import/newline-after-import": 2,
  "import/no-named-as-default-member": 0,
});

/**
 * @rules unused imports and variables
 * from "eslint-plugin-unused-imports".
 */
const unusedCodesRules = () => ({
  "unused-imports/no-unused-imports": 1,
  "unused-imports/no-unused-vars": [
    1,
    {
      vars: "all",
      varsIgnorePattern: "^_",
      args: "after-used",
      argsIgnorePattern: "^_",
      ignoreRestSiblings: true,
    },
  ],
  "no-unused-expressions": [1, { allowShortCircuit: true, allowTernary: true }],
  "no-unused-vars": 0,
  "no-unused-private-class-members": 1,
});

/**
 * @rules sort imports/exports
 * from "eslint-plugin-perfectionist".
 */
const sortImportsRules = () => ({
  "perfectionist/sort-named-imports": [1, { type: "line-length", order: "asc" }],
  "perfectionist/sort-named-exports": [1, { type: "line-length", order: "asc" }],
  "perfectionist/sort-exports": [
    1,
    {
      order: "asc",
      type: "line-length",
    },
  ],
  "perfectionist/sort-imports": [
    2,
    {
      order: "asc",
      ignoreCase: true,
      type: "line-length",
      environment: "node",
      internalPattern: ["^src/.+"],
      groups: [
        "side-effect",
        "type",
        ["builtin", "external"],
        "custom-nestjs",
        "custom-aws",
        "internal",
        "custom-config",
        "custom-common",
        "custom-modules",
        "custom-types",
        ["parent", "sibling", "index"],
        "unknown",
      ],
      customGroups: [
        { groupName: "custom-nestjs", elementNamePattern: "^@nestjs/.+" },
        { groupName: "custom-aws", elementNamePattern: "^@aws-sdk/.+" },
        { groupName: "custom-config", elementNamePattern: "^src/config/.+" },
        { groupName: "custom-common", elementNamePattern: "^src/common/.+" },
        { groupName: "custom-modules", elementNamePattern: "^src/modules/.+" },
        { groupName: "custom-types", elementNamePattern: "^src/types/.+" },
      ],
    },
  ],
});

/**
 * @rules TypeScript-specific
 */
const tsRules = () => ({
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-unsafe-argument": "warn",
});

// ----------------------------------------------------------------------

export const customConfig = {
  plugins: {
    "unused-imports": unusedImportsPlugin,
    perfectionist: perfectionistPlugin,
    import: importPlugin,
    "@stylistic": stylisticPlugin,
  },
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
  rules: {
    ...commonRules(),
    ...importRules(),
    ...unusedCodesRules(),
    ...sortImportsRules(),
    ...tsRules(),
    "quotes": ["warn", "double", { avoidEscape: true }],
    "@stylistic/quotes": ["warn", "double", { avoidEscape: true }],
    "@stylistic/semi": ["warn", "always"],
    "curly": "error",
    "@stylistic/dot-location": ["warn", "property"],
    "@stylistic/indent": ["warn", 2, { SwitchCase: 1 }],
    "@stylistic/multiline-ternary": ["error", "never"],
    "@stylistic/space-before-function-paren": "off",
    "@stylistic/function-call-argument-newline": ["warn", "consistent"],
    "@stylistic/no-multiple-empty-lines": [
      "error",
      {
        max: 1,
        maxEOF: 1,
        maxBOF: 1,
      },
    ],
  },
};

// ----------------------------------------------------------------------

export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { ignores: ["dist/", "node_modules/", "eslint.config.mjs"] },
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintJs.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  customConfig,
  { files: ["**/*.ts"], rules: { "no-undef": "off" } },
];

