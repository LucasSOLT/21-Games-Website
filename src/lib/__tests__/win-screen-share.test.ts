/**
 * Unit Tests for Decoupled Win & Completion Screen Sharing Actions (R3)
 * Target: src/lib/custom-game-share.ts (`nativeShareResultsOnly` & `copyResultsOnly`)
 *
 * Run via:
 *   node --experimental-strip-types --test src/lib/__tests__/win-screen-share.test.ts
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import { afterEach, before, beforeEach, describe, it } from "node:test";

// Register a self-contained ESM resolver hook so `@/*` path aliases and extensionless `.ts`
// imports resolve natively under `node --experimental-strip-types --test`, while capturing
// `toast(...)` invocations in-memory without requiring a full React DOM runtime.
const srcRootHref = new URL("../../", import.meta.url).href;
const toastStubSource = `
export function toast(opts) {
  const store = globalThis.__winShareTestToasts ?? (globalThis.__winShareTestToasts = []);
  store.push(opts);
  return { id: String(store.length), dismiss: () => {}, update: () => {} };
}
export function useToast() {
  return {
    toasts: globalThis.__winShareTestToasts ?? [],
    toast,
    dismiss: () => {},
  };
}
`;
const toastStubDataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(toastStubSource)}`;

const loaderHookSource = `
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC_ROOT = fileURLToPath(${JSON.stringify(srcRootHref)});
const TOAST_STUB_URL = ${JSON.stringify(toastStubDataUrl)};

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/hooks/use-toast") {
    return { shortCircuit: true, url: TOAST_STUB_URL };
  }

  let candidateBase = null;
  if (specifier.startsWith("@/")) {
    candidateBase = path.resolve(SRC_ROOT, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL &&
    context.parentURL.startsWith("file://") &&
    !context.parentURL.includes("/node_modules/")
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    candidateBase = path.resolve(parentDir, specifier);
  }

  if (candidateBase) {
    for (const ext of ["", ".ts", ".tsx", ".js", "/index.ts", "/index.tsx"]) {
      const fullPath = candidateBase + ext;
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        return { shortCircuit: true, url: pathToFileURL(fullPath).href };
      }
    }
  }

  return nextResolve(specifier, context);
}
`;

register(
  `data:text/javascript;charset=utf-8,${encodeURIComponent(loaderHookSource)}`,
  import.meta.url
);

type CustomGameShareModule = typeof import("@/lib/custom-game-share");

interface CapturedToast {
  title?: string;
  description?: string;
}

interface GlobalTestHarness {
  __winShareTestToasts?: CapturedToast[];
}

interface MockNavigatorConfig {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
  writeText?: (text: string) => Promise<void>;
}

interface MockDomConfig {
  execCommandImpl?: (commandId: string) => boolean;
}

let shareModule: CustomGameShareModule;

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator"
);
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "window"
);
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "document"
);

function getCapturedToasts(): CapturedToast[] {
  return (globalThis as unknown as GlobalTestHarness).__winShareTestToasts ?? [];
}

function resetCapturedToasts(): void {
  (globalThis as unknown as GlobalTestHarness).__winShareTestToasts = [];
}

function installBrowserMocks(
  navConfig: MockNavigatorConfig,
  domConfig: MockDomConfig = {}
): {
  shareCalls: ShareData[];
  canShareCalls: Array<ShareData | undefined>;
  clipboardCalls: string[];
  execCommandCalls: string[];
} {
  const shareCalls: ShareData[] = [];
  const canShareCalls: Array<ShareData | undefined> = [];
  const clipboardCalls: string[] = [];
  const execCommandCalls: string[] = [];

  const mockNavigator: Record<string, unknown> = {};

  if (navConfig.share !== undefined) {
    const shareImpl = navConfig.share;
    mockNavigator.share = async (data: ShareData): Promise<void> => {
      shareCalls.push(data);
      return shareImpl(data);
    };
  }

  if (navConfig.canShare !== undefined) {
    const canShareImpl = navConfig.canShare;
    mockNavigator.canShare = (data?: ShareData): boolean => {
      canShareCalls.push(data);
      return canShareImpl(data);
    };
  }

  if (navConfig.writeText !== undefined) {
    const writeTextImpl = navConfig.writeText;
    mockNavigator.clipboard = {
      writeText: async (text: string): Promise<void> => {
        clipboardCalls.push(text);
        return writeTextImpl(text);
      },
    };
  }

  const appendedNodes: unknown[] = [];
  const mockDocument = {
    body: {
      appendChild: (node: unknown) => {
        appendedNodes.push(node);
        return node;
      },
      removeChild: (node: unknown) => {
        const idx = appendedNodes.indexOf(node);
        if (idx >= 0) appendedNodes.splice(idx, 1);
        return node;
      },
    },
    createElement: () => ({
      value: "",
      style: {} as Record<string, string>,
      setAttribute: () => {},
      focus: () => {},
      select: () => {},
    }),
    execCommand: (commandId: string): boolean => {
      execCommandCalls.push(commandId);
      return domConfig.execCommandImpl ? domConfig.execCommandImpl(commandId) : true;
    },
  };

  Object.defineProperty(globalThis, "navigator", {
    value: mockNavigator,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: { location: { origin: "https://21games.ai" } },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: mockDocument,
    configurable: true,
    writable: true,
  });

  return { shareCalls, canShareCalls, clipboardCalls, execCommandCalls };
}

function restoreGlobals(): void {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }

  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }

  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "document");
  }
}

before(async () => {
  shareModule = await import("@/lib/custom-game-share");
});

beforeEach(() => {
  resetCapturedToasts();
});

afterEach(() => {
  restoreGlobals();
  resetCapturedToasts();
});

describe("Win & Completion Screen Decoupled Share / Copy Actions (R3)", () => {
  it("preserves all existing custom-game-share exports alongside new R3 helpers", () => {
    const requiredExports: Array<keyof CustomGameShareModule> = [
      "generateShortGameId",
      "buildBoardShareUrl",
      "buildBoardPlayHref",
      "build17SyllablesShareUrl",
      "build17SyllablesPlayHref",
      "encodeShareable17Haiku",
      "decodeShareable17Haiku",
      "extractCleanUsername",
      "formatCustomGameBlurb",
      "formatCreatorShareBlurb",
      "copyToClipboard",
      "shareCustomGame",
      "shareTextResult",
      "nativeShareResultsOnly",
      "copyResultsOnly",
    ];

    for (const exportName of requiredExports) {
      assert.equal(
        typeof shareModule[exportName],
        "function",
        `Expected ${String(exportName)} to remain an exported function`
      );
    }
  });

  it("nativeShareResultsOnly calls navigator.share once and never touches clipboard on success", async () => {
    const spies = installBrowserMocks({
      share: async () => {},
      writeText: async () => {},
    });

    const result = await shareModule.nativeShareResultsOnly({
      title: "SOL GaMES · Connect 5 #18",
      text: "Connect 5 #18 Solved in 0:42",
      url: "https://21games.ai/games/connect-5",
    });

    assert.deepEqual(result, {
      shared: true,
      unsupported: false,
      aborted: false,
    });
    assert.equal(spies.shareCalls.length, 1);
    assert.deepEqual(spies.shareCalls[0], {
      title: "SOL GaMES · Connect 5 #18",
      text: "Connect 5 #18 Solved in 0:42",
      url: "https://21games.ai/games/connect-5",
    });
    assert.equal(spies.clipboardCalls.length, 0);
    assert.equal(spies.execCommandCalls.length, 0);

    const toasts = getCapturedToasts();
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0]?.title, "Shared!");
    assert.equal(toasts[0]?.description, "Opened native share sheet.");
  });

  it("nativeShareResultsOnly returns unsupported and never touches clipboard or execCommand when navigator.share is undefined", async () => {
    const spies = installBrowserMocks({
      share: undefined,
      writeText: async () => {},
    });

    const result = await shareModule.nativeShareResultsOnly({
      title: "21 Things #9",
      text: "My #1: Fresh morning coffee",
      url: "https://21games.ai/games/21-things",
    });

    assert.deepEqual(result, {
      shared: false,
      unsupported: true,
      aborted: false,
    });
    assert.equal(spies.shareCalls.length, 0);
    assert.equal(spies.clipboardCalls.length, 0);
    assert.equal(spies.execCommandCalls.length, 0);

    const toasts = getCapturedToasts();
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0]?.title, "Native Share Unavailable");
    assert.equal(
      toasts[0]?.description,
      'Your browser doesn\'t support native sharing. Click "Copy results" instead.'
    );
  });

  it("nativeShareResultsOnly handles AbortError silently without error toast or clipboard writes", async () => {
    const spies = installBrowserMocks({
      share: async () => {
        const abortErr = new Error("The user aborted a request.");
        abortErr.name = "AbortError";
        throw abortErr;
      },
      writeText: async () => {},
    });

    const result = await shareModule.nativeShareResultsOnly({
      title: "17 Syllables #12",
      text: "17 Syllables #12 ⭐⭐⭐",
      url: "https://21games.ai/games/17-syllables",
    });

    assert.deepEqual(result, {
      shared: false,
      unsupported: false,
      aborted: true,
    });
    assert.equal(spies.shareCalls.length, 1);
    assert.equal(spies.clipboardCalls.length, 0);
    assert.equal(spies.execCommandCalls.length, 0);
    assert.equal(getCapturedToasts().length, 0);
  });

  it("nativeShareResultsOnly falls back to { title, text: fullText } if canShare rejects url payload, and returns unsupported if canShare rejects all", async () => {
    const fallbackSpies = installBrowserMocks({
      canShare: (data) => Boolean(data && !("url" in data)),
      share: async () => {},
      writeText: async () => {},
    });

    const fallbackResult = await shareModule.nativeShareResultsOnly({
      title: "21 Things #9",
      text: "My 6 -> 3 -> 1 summary",
      url: "https://21games.ai/games/21-things",
    });

    assert.deepEqual(fallbackResult, {
      shared: true,
      unsupported: false,
      aborted: false,
    });
    assert.equal(fallbackSpies.canShareCalls.length, 2);
    assert.equal(fallbackSpies.shareCalls.length, 1);
    assert.deepEqual(fallbackSpies.shareCalls[0], {
      title: "21 Things #9",
      text: "My 6 -> 3 -> 1 summary\nhttps://21games.ai/games/21-things",
    });
    assert.equal(fallbackSpies.clipboardCalls.length, 0);
    assert.equal(fallbackSpies.execCommandCalls.length, 0);

    resetCapturedToasts();

    const rejectedSpies = installBrowserMocks({
      canShare: () => false,
      share: async () => {},
      writeText: async () => {},
    });

    const rejectedResult = await shareModule.nativeShareResultsOnly({
      title: "21 Things #9",
      text: "My 6 -> 3 -> 1 summary",
      url: "https://21games.ai/games/21-things",
    });

    assert.deepEqual(rejectedResult, {
      shared: false,
      unsupported: true,
      aborted: false,
    });
    assert.equal(rejectedSpies.shareCalls.length, 0);
    assert.equal(rejectedSpies.clipboardCalls.length, 0);
    assert.equal(rejectedSpies.execCommandCalls.length, 0);
    assert.equal(getCapturedToasts()[0]?.title, "Native Share Unavailable");
  });

  it("copyResultsOnly writes formatted summary + URL to clipboard and never calls navigator.share", async () => {
    const spies = installBrowserMocks({
      share: async () => {
        throw new Error("navigator.share must never be called by copyResultsOnly");
      },
      canShare: () => {
        throw new Error("navigator.canShare must never be called by copyResultsOnly");
      },
      writeText: async () => {},
    });

    const result = await shareModule.copyResultsOnly({
      title: "Connect 5 #18",
      text: "SOL GaMES · Connect 5 #18\nSolved in 0:42",
      url: "https://21games.ai/games/connect-5",
    });

    assert.deepEqual(result, { copied: true });
    assert.equal(spies.clipboardCalls.length, 1);
    assert.equal(
      spies.clipboardCalls[0],
      "SOL GaMES · Connect 5 #18\nSolved in 0:42\nhttps://21games.ai/games/connect-5"
    );
    assert.equal(spies.shareCalls.length, 0);
    assert.equal(spies.canShareCalls.length, 0);

    const toasts = getCapturedToasts();
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0]?.title, "Results Copied!");
    assert.equal(
      toasts[0]?.description,
      "Your game summary has been copied to the clipboard."
    );
  });

  it("copyResultsOnly avoids duplicating an already-present URL and handles copy failures gracefully", async () => {
    const dedupSpies = installBrowserMocks({
      share: async () => {},
      writeText: async () => {},
    });

    const existingText =
      "17 Syllables #12 ⭐⭐⭐\nPlay at https://21games.ai/games/17-syllables";
    const dedupResult = await shareModule.copyResultsOnly({
      title: "17 Syllables #12",
      text: existingText,
      url: "https://21games.ai/games/17-syllables",
    });

    assert.deepEqual(dedupResult, { copied: true });
    assert.equal(dedupSpies.clipboardCalls.length, 1);
    assert.equal(dedupSpies.clipboardCalls[0], existingText);
    assert.equal(dedupSpies.shareCalls.length, 0);

    resetCapturedToasts();

    const failSpies = installBrowserMocks(
      {
        share: async () => {},
        writeText: async () => {
          throw new Error("Clipboard permission denied");
        },
      },
      {
        execCommandImpl: () => false,
      }
    );

    const failResult = await shareModule.copyResultsOnly({
      title: "17 Syllables #12",
      text: "17 Syllables #12 ⭐⭐⭐",
    });

    assert.deepEqual(failResult, { copied: false });
    assert.equal(failSpies.shareCalls.length, 0);
    assert.deepEqual(failSpies.execCommandCalls, ["copy"]);

    const toasts = getCapturedToasts();
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0]?.title, "Copy Failed");
    assert.equal(
      toasts[0]?.description,
      "Could not copy results to the clipboard."
    );
  });

  it("respects showToast: false in both nativeShareResultsOnly and copyResultsOnly", async () => {
    installBrowserMocks({
      share: async () => {},
      writeText: async () => {},
    });

    await shareModule.nativeShareResultsOnly({
      title: "Quiet Share",
      text: "Summary",
      showToast: false,
    });
    await shareModule.copyResultsOnly({
      title: "Quiet Copy",
      text: "Summary",
      showToast: false,
    });

    assert.equal(getCapturedToasts().length, 0);
  });
});
