/**
 * Vitest setup — runs before each test file.
 *
 * Handles:
 *  - localStorage isolation between tests (prevents cross-test pollution)
 *  - requestAnimationFrame shim for jsdom (needed for animate/countup utilities)
 *  - sessionStorage isolation
 *  - console.error filtering (React Router warnings etc.)
 *  - `@/` alias support for dynamic `require("@/...")` calls in test files
 */

import { beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import Module from "node:module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

// ── `@/` alias for dynamic require()/import() ──
// vite/vitest resolve the `@/` alias for static `import`, but some tests call
// `require("@/hooks/...")` at runtime (to defer loading until after localStorage is
// mocked). That require — and the real ESM loader it triggers for every nested
// `@/...` import in the loaded module's own graph — is Node's native module system,
// which has no knowledge of the Vite alias. Two layers are needed:
//  1. Module._resolveFilename patch — handles the top-level require("@/...") call.
//  2. An ESM loader hook (module.register) — handles nested `import ... from "@/..."`
//     statements inside the required module's own dependency graph.
const SRC_ROOT = path.resolve(__dirname, "./src");
const originalResolveFilename = (Module as unknown as { _resolveFilename: (...args: unknown[]) => string })
  ._resolveFilename;
(Module as unknown as { _resolveFilename: (...args: unknown[]) => string })._resolveFilename = function (
  this: unknown,
  request: string,
  ...rest: unknown[]
) {
  if (request.startsWith("@/")) {
    const target = path.join(SRC_ROOT, request.slice(2));
    const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`];
    for (const candidate of candidates) {
      try {
        return originalResolveFilename.call(this, candidate, ...rest);
      } catch {
        // try next candidate
      }
    }
  }
  return originalResolveFilename.call(this, request, ...rest);
};

declare global {
  // eslint-disable-next-line no-var
  var __subtrackAliasLoaderRegistered: boolean | undefined;
}

if (!globalThis.__subtrackAliasLoaderRegistered) {
  globalThis.__subtrackAliasLoaderRegistered = true;
  const srcRootUrl = pathToFileURL(`${SRC_ROOT}/`).href;
  const loaderSource = `
    import { existsSync } from "node:fs";
    import { fileURLToPath } from "node:url";
    const SRC_ROOT = new URL(${JSON.stringify(srcRootUrl)});
    export async function resolve(specifier, context, nextResolve) {
      if (specifier.startsWith("@/")) {
        const rel = specifier.slice(2);
        const candidates = [
          new URL(rel, SRC_ROOT),
          new URL(rel + ".ts", SRC_ROOT),
          new URL(rel + ".tsx", SRC_ROOT),
          new URL(rel + "/index.ts", SRC_ROOT),
        ];
        for (const candidate of candidates) {
          try {
            if (existsSync(fileURLToPath(candidate))) {
              return nextResolve(candidate.href, context);
            }
          } catch {}
        }
      }
      return nextResolve(specifier, context);
    }
  `;
  register(`data:text/javascript,${encodeURIComponent(loaderSource)}`);
}

// ── localStorage / sessionStorage isolation ──
// jsdom's storage persists between tests by default. Clear it to prevent pollution.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// ── requestAnimationFrame shim for jsdom ──
// jsdom does NOT implement rAF natively, so animate/countup code hangs forever.
// Shim that immediately invokes callback with a monotonic timestamp.
if (typeof globalThis.requestAnimationFrame !== "function") {
  let now = 0;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    now += 16;
    return setTimeout(() => cb(now), 0) as unknown as number;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof globalThis.cancelAnimationFrame;
}

// ── afterEach reset ──
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers(); // in case a test used fake timers
});
