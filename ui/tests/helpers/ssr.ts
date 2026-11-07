import { fileURLToPath } from "node:url";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";

/**
 * Loads the real source components through Vite's SSR transform (the same TSX, aliases and JSON imports as
 * the app build) so tests can render them to markup and assert on roles, states and text without adding a
 * browser or a DOM library. One server is shared by every test file in the process.
 */
let server: Promise<ViteDevServer> | null = null;

function start(): Promise<ViteDevServer> {
  server ??= createServer({
    root: fileURLToPath(new URL("../..", import.meta.url)),
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  return server;
}

export async function loadModule<T = Record<string, unknown>>(path: string): Promise<T> {
  const vite = await start();
  return (await vite.ssrLoadModule(path)) as T;
}

export function render<P extends object>(component: ComponentType<P>, props: P): string {
  return renderToStaticMarkup(createElement(component as ComponentType<object>, props as object));
}

export async function closeServer(): Promise<void> {
  if (!server) return;
  const vite = await server;
  server = null;
  await vite.close();
}
