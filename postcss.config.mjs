import { fileURLToPath } from "node:url";

const legacyCompatPluginPath = fileURLToPath(
  new URL("./postcss-legacy-compat.cjs", import.meta.url)
);

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    [legacyCompatPluginPath]: {},
  },
};

export default config;
