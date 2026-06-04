const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
    {
        ignores: ["dist/**", "node_modules/**", "jest.config.ts"],
    },
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                project: ["./tsconfig.json"],
                tsconfigRootDir: __dirname,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...tsPlugin.configs["recommended-type-checked"].rules,
            "@typescript-eslint/explicit-function-return-type": "warn",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-floating-promises": "error",
        },
    },
];
