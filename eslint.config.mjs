import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Turn off img tag warnings (we're using Cloudinary URLs which are external)
      "@next/next/no-img-element": "off",
      // Allow some missing dependencies in useEffect (refs are stable)
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
