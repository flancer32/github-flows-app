// @ts-check

/**
 * @namespace Github_Flows_App_Log_Retention_Scheduler
 * @description Periodic archival log cleanup scheduler.
 */
const HOUR_IN_MS = 60 * 60 * 1000;

export default class Github_Flows_App_Log_Retention_Scheduler {
  /**
   * @param {object} deps
   * @param {Github_Flows_App_Log_Retention_Cleanup} deps.cleanup
   */
  constructor({ cleanup }) {
    let timerId;
    let stopped = true;

    const log = (method, message, data) => {
      if (data === undefined) {
        console[method](message);
        return;
      }
      console[method](message, data);
    };

    const runCleanup = async params => {
      try {
        const result = await cleanup.cleanup(params);
        if (!result.enabled) {
          log("info", "[log-retention] cleanup disabled", { workspaceRoot: params.workspaceRoot });
          return result;
        }
        log("info", "[log-retention] cleanup completed", { ...result, workspaceRoot: params.workspaceRoot });
        return result;
      } catch (error) {
        log("error", "[log-retention] cleanup failed", {
          error: asError(error).message,
          workspaceRoot: params.workspaceRoot,
        });
        return { enabled: true, inspected: 0, removed: 0, removedLinks: 0, error: asError(error).message };
      }
    };

    const asError = value => value instanceof Error ? value : new Error(String(value));

    this.start = async function (params) {
      if (!stopped) {
        return;
      }
      stopped = false;
      log("info", "[log-retention] scheduler started", {
        intervalMs: HOUR_IN_MS,
        workspaceRoot: params.workspaceRoot,
      });
      await runCleanup(params);
      timerId = setInterval(() => {
        void runCleanup(params);
      }, HOUR_IN_MS);
      if (typeof timerId?.unref === "function") {
        timerId.unref();
      }
    };

    this.stop = async function () {
      if (stopped) {
        return;
      }
      stopped = true;
      if (timerId !== undefined) {
        clearInterval(timerId);
        timerId = undefined;
      }
      log("info", "[log-retention] scheduler stopped");
    };
  }
}

export const __deps__ = Object.freeze({
  default: {
    cleanup: "Github_Flows_App_Log_Retention_Cleanup$",
  },
});
