// @ts-check

/**
 * @namespace Github_Flows_App_Log_Retention_Cleanup
 * @description Host-owned archival log cleanup service.
 */
const LOG_RUN_SEGMENTS = Object.freeze(["log", "run"]);
const LOG_INDEX_SEGMENTS = Object.freeze(["log", "index"]);
const HOUR_IN_MS = 60 * 60 * 1000;

const isDirentDirectory = dirent => typeof dirent?.isDirectory === "function" && dirent.isDirectory();

const asError = value => value instanceof Error ? value : new Error(String(value));

const nowMs = () => Date.now();

export default class Github_Flows_App_Log_Retention_Cleanup {
  /**
   * @param {object} deps
   * @param {typeof import("node:fs/promises")} deps.fsPromises
   * @param {typeof import("node:path")} deps.path
   */
  constructor({ fsPromises, path }) {
    const readDirectories = async directory => {
      try {
        return await fsPromises.readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (error && error.code === "ENOENT") return [];
        throw error;
      }
    };

    const removeBrokenOrTargetedIndexLinks = async ({ indexRoot, removedTargets }) => {
      const stack = [indexRoot];
      let removedLinks = 0;

      while (stack.length > 0) {
        const current = stack.pop();
        const entries = await readDirectories(current);
        for (const entry of entries) {
          const entryPath = path.join(current, entry.name);
          if (isDirentDirectory(entry)) {
            stack.push(entryPath);
            continue;
          }
          if (!entry.isSymbolicLink?.()) {
            continue;
          }
          try {
            const targetPath = await fsPromises.realpath(entryPath);
            if (removedTargets.has(targetPath)) {
              await fsPromises.unlink(entryPath);
              removedLinks += 1;
            }
          } catch (error) {
            if (error && error.code === "ENOENT") {
              try {
                await fsPromises.unlink(entryPath);
                removedLinks += 1;
              } catch {}
              continue;
            }
            throw error;
          }
        }
      }

      return removedLinks;
    };

    const cleanupRunTree = async ({ retentionCutoffMs, runRoot }) => {
      const removedTargets = new Set();
      let inspected = 0;
      let removed = 0;
      const stack = [runRoot];

      while (stack.length > 0) {
        const current = stack.pop();
        const entries = await readDirectories(current);
        for (const entry of entries) {
          const entryPath = path.join(current, entry.name);
          if (!isDirentDirectory(entry)) {
            continue;
          }
          const nextDepth = path.relative(runRoot, entryPath).split(path.sep).filter(Boolean).length;
          if (nextDepth < 3) {
            stack.push(entryPath);
            continue;
          }
          inspected += 1;
          const stat = await fsPromises.stat(entryPath);
          if (stat.mtimeMs < retentionCutoffMs) {
            await fsPromises.rm(entryPath, { recursive: true, force: true });
            removed += 1;
            removedTargets.add(entryPath);
          }
        }
      }

      return { inspected, removed, removedTargets };
    };

    this.cleanup = async function ({ logRetentionDays, workspaceRoot }) {
      if (!Number.isInteger(logRetentionDays) || logRetentionDays < 1) {
        return { enabled: false, inspected: 0, removed: 0, removedLinks: 0 };
      }

      const runRoot = path.resolve(workspaceRoot, ...LOG_RUN_SEGMENTS);
      const indexRoot = path.resolve(workspaceRoot, ...LOG_INDEX_SEGMENTS);
      const retentionCutoffMs = nowMs() - (logRetentionDays * HOUR_IN_MS * 24);

      const { inspected, removed, removedTargets } = await cleanupRunTree({ retentionCutoffMs, runRoot });
      const removedLinks = await removeBrokenOrTargetedIndexLinks({ indexRoot, removedTargets });

      return { enabled: true, inspected, removed, removedLinks };
    };
  }
}

export const __deps__ = Object.freeze({
  default: {
    fsPromises: "node:fs/promises",
    path: "node:path",
  },
});
