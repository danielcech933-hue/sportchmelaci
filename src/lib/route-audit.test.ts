import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROUTES_DIR = join(process.cwd(), "src", "routes");

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (full.endsWith(".tsx")) files.push(full);
  }
  return files;
}

function routePattern(file: string): string | null {
  const rel = relative(ROUTES_DIR, file).replaceAll("\\", "/");
  const parts = rel.split("/");
  const leaf = parts.pop()!.replace(/\.tsx$/, "");
  if (leaf === "__root" || leaf.startsWith("[.")) return null;
  if (parts.some((part) => part.startsWith("[."))) return null;
  // Pathless/parent layout files (e.g. slots.tsx next to slots.index.tsx) only
  // render an <Outlet />; their concrete path comes from the index child.
  if (readFileSync(file, "utf8").includes("<Outlet />") && !leaf.includes(".")) {
    const hasChildren = readdirSync(join(ROUTES_DIR, ...parts)).some((entry) => entry.startsWith(`${leaf}.`));
    if (hasChildren) return null;
  }

  const segments = [...parts, ...leaf.split(".")];
  if (segments[segments.length - 1] === "index") segments.pop();
  if (segments.length === 0) return "/";

  return (
    "/" +
    segments
      .filter(Boolean)
      .map((segment) => {
        if (segment.startsWith("$") || segment === "$.tsx") return ":dynamic";
        if (segment.startsWith("{")) return ":optional";
        return segment;
      })
      .join("/")
  );
}

function toComparable(path: string): string {
  return path.split("?")[0].replace(/\/$/, "") || "/";
}

function matches(pattern: string, target: string): boolean {
  const p = toComparable(pattern).split("/").filter(Boolean);
  const t = toComparable(target).split("/").filter(Boolean);
  if (p.length !== t.length) return false;
  return p.every((part, i) => part.startsWith(":") || part === t[i]);
}

describe("route integrity audit", () => {
  const routePatterns = walk(ROUTES_DIR).map(routePattern).filter((value): value is string => Boolean(value));
  const uniquePatterns = [...new Set(routePatterns)];

  test("route files resolve to unique route patterns", () => {
    expect(routePatterns.length).toBe(uniquePatterns.length);
  });

  test("all explicit internal Link targets point to a known route", () => {
    const linked = new Map<string, string[]>();
    for (const file of walk(ROUTES_DIR)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\bto\s*=\s*[\"'](\/[^\"']*)[\"']/g)) {
        const target = match[1];
        if (target.startsWith("//") || target.startsWith("/api/")) continue;
        const list = linked.get(target) ?? [];
        list.push(relative(process.cwd(), file));
        linked.set(target, list);
      }
    }

    const unresolved = [...linked.entries()].filter(([target]) => !uniquePatterns.some((pattern) => matches(pattern, target)));
    expect(unresolved, unresolved.map(([target, files]) => `${target} <- ${files.join(", ")}`).join("\n")).toHaveLength(0);
  });
});
