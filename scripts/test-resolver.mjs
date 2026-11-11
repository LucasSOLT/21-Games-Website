import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  let basePath = null;

  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    basePath = path.resolve(process.cwd(), "src", rel);
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL &&
    context.parentURL.startsWith("file://") &&
    !context.parentURL.includes("/node_modules/")
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    basePath = path.resolve(parentDir, specifier);
  }

  if (basePath) {
    for (const ext of ["", ".ts", ".tsx", ".js", "/index.ts", "/index.tsx"]) {
      const candidate = basePath + ext;
      if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
        return {
          shortCircuit: true,
          url: pathToFileURL(candidate).href,
        };
      }
    }
  }

  if (specifier.startsWith("next/")) {
    const nextCandidate = path.resolve(
      process.cwd(),
      "node_modules",
      `${specifier}.js`
    );
    if (fs.existsSync(nextCandidate)) {
      return {
        shortCircuit: true,
        url: pathToFileURL(nextCandidate).href,
      };
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (
    url.startsWith("file://") &&
    url.endsWith(".tsx") &&
    !url.includes("/node_modules/")
  ) {
    const filePath = fileURLToPath(url);
    const source = fs.readFileSync(filePath, "utf8");
    const transpiled = ts.transpileModule(source, {
      fileName: filePath,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    return {
      format: "module",
      shortCircuit: true,
      source: transpiled.outputText,
    };
  }
  return nextLoad(url, context);
}
