#!/usr/bin/env node
/**
 * Universal CLI bootstrap for TeqFW applications.
 */

import fs from "node:fs/promises";
import path from "node:path";
import processModule from "node:process";
import { fileURLToPath } from "node:url";

import Container from "@teqfw/di/src/Container.mjs";
import NamespaceRegistry from "@teqfw/di/src/Config/NamespaceRegistry.mjs";

/**
 * TeqFW DI context (minimal for agents):
 *
 * CDC (Canonical Dependency Code):
 *   "Namespace_Component_Path$"
 *
 * Resolution:
 *   - "$" → default export singleton
 *   - "Ns_A_B$" → <namespace root>/A/B + ext
 *
 * Namespace roots:
 *   registered at runtime as (prefix → directory → extension)
 *   and define how CDC maps to filesystem modules
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const container = new Container();
// DO NOT use container.register here (tests only)

/**
 * NamespaceRegistry:
 * discovers and returns namespace root mappings
 * based on project structure and TeqFW conventions
 */
const namespaceRegistry = new NamespaceRegistry({ fs, path, appRoot: projectRoot });

/**
 * @type {Array<{ prefix: string, dirAbs: string, ext: string }>}
 */
const entries = await namespaceRegistry.build();

for (const entry of entries) {
  // entry.prefix — namespace prefix (e.g. "App_")
  // entry.dirAbs — absolute path to source directory
  // entry.ext — file extension (e.g. ".js", ".mjs")
  container.addNamespaceRoot(entry.prefix, entry.dirAbs, entry.ext);
}

// Raw CLI arguments (no parsing at bootstrap level)
const cliArgs = processModule.argv.slice(2);

/**
 * Root application component (project-specific).
 *
 * Contract:
 * - run({ projectRoot, cliArgs }): Promise<number>
 * - stop(): Promise<void>
 */
/** @type {Github_Flows_App_Bootstrap} */
const app = await container.get("Github_Flows_App_Bootstrap$");

let exitCode = 1;
let stopRequested = false;

// Shutdown is best-effort and must run only once
const stopApp = async function () {
  if (stopRequested) {
    return;
  }

  stopRequested = true;

  try {
    await app.stop();
  } catch (error) {
    console.error(error);
  }
};

// Map OS signals to graceful shutdown
for (const signal of ["SIGINT", "SIGTERM"]) {
  processModule.once(signal, () => {
    void stopApp();
  });
}

try {
  // exitCode is defined by app.run()
  exitCode = await app.run({ projectRoot, cliArgs });
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await stopApp();
}

// Fallback to 1 if exitCode is invalid
processModule.exit(typeof exitCode === "number" ? exitCode : 1);