import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const basePath = path.resolve(process.cwd(), "src", rel);
    for (const ext of [".ts", ".tsx", ".js", "/index.ts", "/index.tsx", ""]) {
      const candidate = basePath + ext;
      if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
        return {
          shortCircuit: true,
          url: pathToFileURL(candidate).href,
        };
      }
    }
  }
  return nextResolve(specifier, context);
}
