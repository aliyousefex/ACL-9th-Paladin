import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * The site is developed on Windows or macOS, where file names are case-insensitive, and built on Linux, where they are not.
 * Two files that differ only by case (grandPrix.ts and GrandPrix.tsx), or an import spelled with the wrong case, work locally
 * and then fail the production build. These checks make that impossible to commit by accident.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_DIRS = ["src", "tests"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const files = SOURCE_DIRS.flatMap((d) => walk(join(root, d))).filter((f) => /\.(ts|tsx|css|json|js|mjs)$/.test(f));
const code = files.filter((f) => /\.(ts|tsx)$/.test(f));

/** True when every segment of the path exists with exactly this spelling. */
function existsExact(path: string): boolean {
  const rel = relative(root, path).split(/[\\/]/);
  let dir = root;
  for (const segment of rel) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return false;
    }
    if (!entries.includes(segment)) return false;
    dir = join(dir, segment);
  }
  return true;
}

test("no two source files differ only by letter case, even when their extensions differ", () => {
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const file of files) {
    const rel = relative(root, file).replace(/\\/g, "/");
    // Compare the full path without its extension, because an import such as "./GrandPrix" matches either extension.
    const key = rel.replace(/\.(ts|tsx)$/, "").toLowerCase();
    const other = seen.get(key);
    if (other && other !== rel) clashes.push(`${other}  vs  ${rel}`);
    seen.set(key, rel);
  }
  assert.deepEqual(clashes, [], `files that collide on a case-sensitive system:\n${clashes.join("\n")}`);
});

test("every relative import names its file with exactly the right case", () => {
  const re = /(?:from\s+|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g;
  const wrong: string[] = [];
  for (const file of code) {
    const text = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const spec = m[1].split("?")[0];
      const base = resolve(dirname(file), spec);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.json`, `${base}.css`, join(base, "index.ts"), join(base, "index.tsx")];
      if (!candidates.some((c) => existsExact(c))) wrong.push(`${relative(root, file).replace(/\\/g, "/")}: "${spec}"`);
    }
  }
  assert.deepEqual(wrong, [], `imports that do not match a file name exactly:\n${wrong.join("\n")}`);
});

test("the checker itself can tell a wrong-case path from a right one", () => {
  assert.equal(existsExact(join(root, "src", "main.tsx")), true);
  assert.equal(existsExact(join(root, "src", "Main.tsx")), false);
  assert.equal(existsExact(join(root, "SRC", "main.tsx")), false);
  assert.ok(files.length > 100 && code.length > 80);
});
