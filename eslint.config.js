import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

import importsTogether from "./eslint-local/imports-together.js";
import noLiteralZodEnum from "./eslint-local/no-literal-zod-enum.js";
import noMagicStrings from "./eslint-local/no-magic-strings.js";
import noEmptyJsx from "./eslint-local/no-empty-jsx.js";
import noNestedIf from "./eslint-local/no-nested-if.js";
import noComments from "./eslint-local/no-comments.js";

const serverOnly = {
  name: "server-only",
  message:
    "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
};

const colourSelectors = [
  ["Literal", "value"],
  ["TemplateElement", "value.raw"],
].flatMap(([node, prop]) => [
  {
    selector: `${node}[${prop}=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]`,
    message: "Use a colour token from styles.css instead of a hex value.",
  },
  {
    selector: String.raw`${node}[${prop}=/-\[#[0-9a-fA-F]{3,8}\]/]`,
    message: "Use a colour token from styles.css instead of an arbitrary hex value.",
  },
  {
    selector: String.raw`${node}[${prop}=/\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|decoration)-(?:white|black|(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]{2,3})\b/]`,
    message:
      "Use a token of the Compasso palette (ink, violet, orchid, coral…) or a semantic token, not pure black/white or the default Tailwind palette.",
  },
]);

const asUnknownAs = {
  selector: 'TSAsExpression > TSAsExpression.expression[typeAnnotation.type="TSUnknownKeyword"]',
  message:
    "Do not cast through `unknown`: type the source or validate the value with zod (parseOutput).",
};

const rawCard = ["Literal", "TemplateElement"].map((node) => ({
  selector: String.raw`${node}[${node === "Literal" ? "value" : "value.raw"}=/rounded-2xl border border-border bg-card/]`,
  message: "Use <SectionCard> (components/shared/admin) instead of writing the card classes.",
}));

const rawFieldset = {
  selector: 'JSXOpeningElement[name.name="fieldset"]',
  message: "Use FieldGroup (components/shared/admin/field-group) instead of a raw <fieldset>.",
};

const KINDS = ["components", "lib", "hooks"];

const noSiteContentInCode = {
  group: ["@/assets/site/**", "@/data/site/**", "@/lib/site/i18n/**"],
  message:
    "The public site takes its content from the CMS: images, texts and media do not live in the code.",
};

const serviceRoleAllowed = [
  "src/lib/shared/auth/invitations/**/*.ts",
  "src/lib/shared/jobs/**/*.ts",
  "src/lib/shared/audit/**/*.ts",
  "src/lib/shared/media/**/*.server.ts",
];

const serviceRoleClient = {
  group: ["@/lib/shared/supabase/admin.server"],
  message:
    "The service-role client is only for invitation acceptance, jobs, audit and media signing (SEC-5).",
};

const boundary = (space, forbidden) => ({
  files: KINDS.map((kind) => `src/${kind}/${space}/**/*.{ts,tsx}`),
  ignores: serviceRoleAllowed,
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [serverOnly],
        patterns: [
          noSiteContentInCode,
          serviceRoleClient,
          {
            group: forbidden.flatMap((other) => KINDS.map((kind) => `@/${kind}/${other}/**`)),
            message: `\`${space}\` cannot import from ${forbidden.join(" or ")}: move what is shared into \`shared\`.`,
          },
        ],
      },
    ],
  },
});

const colourExempt = [
  "src/components/shared/ui/color-field.tsx",
  "src/components/shared/ui/chart.tsx",
];

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", ".vercel", ".tanstack", "src/routeTree.gen.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
      "no-restricted-imports": [
        "error",
        { paths: [serverOnly], patterns: [noSiteContentInCode, serviceRoleClient] },
      ],
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-useless-empty-export": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": "error",
      "no-empty": "error",
      "@typescript-eslint/no-empty-function": "error",
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": ["error", "always"],
      "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
      "no-else-return": ["error", { allowElseIf: false }],
      "no-throw-literal": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "warn",
      "no-useless-concat": "error",
      "no-useless-return": "error",
      "prefer-object-spread": "error",
      "array-callback-return": "error",
      "default-case-last": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  {
    files: ["src/**/*.tsx"],
    ignores: colourExempt,
    rules: {
      "no-restricted-syntax": ["error", ...colourSelectors, rawFieldset, asUnknownAs, ...rawCard],
    },
  },
  {
    files: colourExempt,
    rules: { "no-restricted-syntax": ["error", asUnknownAs] },
  },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/routeTree.gen.ts"],
    rules: { "no-restricted-syntax": ["error", asUnknownAs] },
  },
  {
    files: ["src/components/**/*.tsx", "src/routes/**/*.tsx"],
    rules: { "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ["src/components/shared/ui/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      local: {
        rules: {
          "no-comments": noComments,
          "imports-together": importsTogether,
          "no-nested-if": noNestedIf,
          "no-empty-jsx": noEmptyJsx,
          "no-magic-strings": noMagicStrings,
          "no-literal-zod-enum": noLiteralZodEnum,
        },
      },
    },
    rules: {
      "local/no-comments": "error",
      "local/imports-together": "error",
      "local/no-nested-if": "error",
      "local/no-empty-jsx": "error",
      "local/no-magic-strings": "error",
      "local/no-literal-zod-enum": "error",
    },
  },
  boundary("marketing", ["cms", "site", "portal"]),
  boundary("cms", ["marketing", "site", "portal"]),
  boundary("site", ["marketing", "cms", "portal"]),
  boundary("portal", ["marketing", "cms", "site"]),
  boundary("shared", ["marketing", "cms", "site", "portal"]),
  {
    files: serviceRoleAllowed,
    rules: {
      "no-restricted-imports": ["error", { paths: [serverOnly], patterns: [noSiteContentInCode] }],
    },
  },
  eslintPluginPrettier,
);
