import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_App_Log_Retention_Scheduler from "../../../../src/Log/Retention/Scheduler.mjs";

test("Scheduler runs cleanup at startup and then on hourly interval", async () => {
  const calls = [];
  let intervalCallback;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  globalThis.setInterval = (callback, delay) => {
    calls.push(["setInterval", delay]);
    intervalCallback = callback;
    return { unref() {}, delay };
  };
  globalThis.clearInterval = timer => {
    calls.push(["clearInterval", timer.delay]);
  };

  try {
    const scheduler = new Github_Flows_App_Log_Retention_Scheduler({
      cleanup: {
        async cleanup(params) {
          calls.push(["cleanup", params]);
          return {
            enabled: true,
            inspected: 2,
            removed: 1,
            removedLinks: 1,
          };
        },
      },
    });

    await scheduler.start({
      logRetentionDays: 7,
      workspaceRoot: "/tmp/work",
    });
    await intervalCallback();
    await scheduler.stop();

    assert.deepEqual(calls, [
      ["cleanup", {
        logRetentionDays: 7,
        workspaceRoot: "/tmp/work",
      }],
      ["setInterval", 60 * 60 * 1000],
      ["cleanup", {
        logRetentionDays: 7,
        workspaceRoot: "/tmp/work",
      }],
      ["clearInterval", 60 * 60 * 1000],
    ]);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test("Scheduler logs disabled cleanup but does not fail", async () => {
  const calls = [];
  const originalInfo = console.info;
  console.info = (...args) => calls.push(args);

  try {
    const scheduler = new Github_Flows_App_Log_Retention_Scheduler({
      cleanup: {
        async cleanup(params) {
          calls.push(["cleanup", params]);
          return {
            enabled: false,
            inspected: 0,
            removed: 0,
            removedLinks: 0,
          };
        },
      },
    });

    await scheduler.start({
      logRetentionDays: undefined,
      workspaceRoot: "/tmp/work",
    });
    await scheduler.stop();

    assert.equal(calls.some(args => JSON.stringify(args).includes("cleanup disabled")), true);
  } finally {
    console.info = originalInfo;
  }
});
