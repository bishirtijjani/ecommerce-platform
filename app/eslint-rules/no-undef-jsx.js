/**
 * no-undef-jsx
 *
 * ESLint's built-in `no-undef` does NOT report identifiers used as JSX
 * element names - `<TextInput />` with no import sails straight through,
 * because the scope analyzer never creates a reference for a JSXIdentifier.
 *
 * That is not a theoretical hole. SellerProductFormScreen.js rendered
 * `<TextInput />` in its variant editor without importing TextInput, so the
 * whole Add/Edit Product screen threw "TextInput is not defined" the moment
 * it drew a variant row. `eslint-plugin-react` has `react/jsx-no-undef` for
 * this, but pulling that plugin in for one rule is a heavy dependency for a
 * mobile app bundle - so this rule does the same job in ~40 lines.
 *
 * Lowercase names (`<div />`, `<br />`) are HTML intrinsics, never variables,
 * so they are skipped.
 */

const KNOWN_GLOBALS = new Set(["React"]);

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow undefined variables used as JSX element names",
      recommended: true,
    },
    schema: [],
    messages: {
      undef: "'{{name}}' is not defined. Import it, or remove the JSX element.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;

    const isDefined = (name, node) => {
      let scope = sourceCode.getScope(node);
      while (scope) {
        if (scope.set.has(name)) return true;
        scope = scope.upper;
      }
      return false;
    };

    // `<Foo.Bar />` - only the root identifier is a variable reference.
    const rootIdentifier = (node) => {
      let target = node.name;
      while (target && target.type === "JSXMemberExpression") target = target.object;
      return target && target.type === "JSXIdentifier" ? target : null;
    };

    const check = (node) => {
      const identifier = rootIdentifier(node);
      if (!identifier) return;
      const name = identifier.name;
      if (!/^[A-Z]/.test(name)) return; // intrinsic element
      if (KNOWN_GLOBALS.has(name)) return;
      if (isDefined(name, node)) return;
      context.report({ node, messageId: "undef", data: { name } });
    };

    return {
      JSXOpeningElement: check,
    };
  },
};
