/**
 * Mobile customer-app ESLint flat config.
 *
 * Three guards, all of them earned by a bug that actually shipped:
 *
 * 1. The api-path contract (from Phase 0): every `api.<method>(...)` call
 *    must use a path that begins with "/". Relative paths get concatenated
 *    against the wrong base URL and produce 404s in production.
 *
 * 2. `no-undef` - a variable used before it is defined is a runtime crash.
 *
 * 3. `local/no-undef-jsx` - ESLint's core `no-undef` skips JSX element
 *    names, so `<TextInput />` with no import was never flagged. That bug
 *    shipped in SellerProductFormScreen.js and made the whole Add/Edit
 *    Product screen throw as soon as it drew a variant row. The rule lives
 *    in ./eslint-rules/no-undef-jsx.js.
 */

const noUndefJsx = require("./eslint-rules/no-undef-jsx");

module.exports = [
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        console: "readonly",
        process: "readonly",
        __DEV__: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        navigator: "readonly",
        window: "readonly",
        document: "readonly",
        alert: "readonly",
        FormData: "readonly",
        Image: "readonly",
        require: "readonly",
        URLSearchParams: "readonly",
        requestAnimationFrame: "readonly",
        Notification: "readonly",
        atob: "readonly",
        btoa: "readonly",
      },
    },
    plugins: {
      local: { rules: { "no-undef-jsx": noUndefJsx } },
    },
    rules: {
      "no-undef": "error",
      "local/no-undef-jsx": "error",
      "no-restricted-syntax": [
        "error",
        // String literal path that does not start with "/".
        {
          selector:
            "CallExpression[callee.object.name='api'][callee.property.name=/^(get|post|put|patch|delete)$/] > Literal:first-child:not([value=/^\\//])",
          message:
            "API client paths must start with '/' (e.g. api.get('/wallet'), not api.get('wallet')).",
        },
        // Template literal path whose first quasi cooked value does not start with "/".
        {
          selector:
            "CallExpression[callee.object.name='api'][callee.property.name=/^(get|post|put|patch|delete)$/] > TemplateLiteral:first-child > TemplateElement.quasis:first-child:not([value.cooked=/^\\//])",
          message:
            "API client template-literal paths must start with '/' (e.g. api.get(`/wallet/${id}`)).",
        },
      ],
    },
  },
];
