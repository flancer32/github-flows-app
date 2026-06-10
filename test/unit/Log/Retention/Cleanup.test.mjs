import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Github_Flows_App_Log_Retention_Cleanup from "../../../../src/Log/Retention/Cleanup.mjs";

const createWorkspace = async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
  const runFresh = path.join(workspaceRoot, "log", "run", "owner", "repo", "fresh");
  const runStale = path.join(workspaceRoot, "log", "run", "owner", "repo", "stale");
  const indexFresh = path.join(workspaceRoot, "log", "index", "by-event", "owner", "repo", "issues", "fresh");
  const indexStale = path.join(workspaceRoot, "log", "index", "by-event", "owner", "repo", "issues", "stale");

  await fs.mkdir(runFresh, { recursive: true });
  await fs.mkdir(runStale, { recursive: true });
  await fs.mkdir(path.dirname(indexFresh), { recursive: true });
  await fs.mkdir(path.dirname(indexStale), { recursive: true });
  await fs.symlink(path.relative(path.dirname(indexFresh), runFresh), indexFresh, "dir");
  await fs.symlink(path.relative(path.dirname(indexStale), runStale), indexStale, "dir");
  await fs.utimes(runFresh, new Date(), new Date());
  await fs.utimes(runStale, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));

  return { indexFresh, indexStale, runFresh, runStale, workspaceRoot };
};

test("Cleanup removes stale run archives and matching derived links", async () => {
  const { indexFresh, indexStale, runFresh, runStale, workspaceRoot } = await createWorkspace();
  const cleanup = new Github_Flows_App_Log_Retention_Cleanup({
    fsPromises: fs,
    path,
  });

  try {
    const result = await cleanup.cleanup({
      logRetentionDays: 1,
      workspaceRoot,
    });

    assert.equal(result.enabled, true);
    assert.equal(result.removed, 1);
    assert.equal(result.removedLinks, 1);
    await assert.doesNotReject(() => fs.stat(runFresh));
    await assert.rejects(() => fs.stat(runStale));
    await assert.doesNotReject(() => fs.stat(indexFresh));
    await assert.rejects(() => fs.lstat(indexStale));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("Cleanup disables itself for missing retention configuration", async () => {
  const cleanup = new Github_Flows_App_Log_Retention_Cleanup({
    fsPromises: fs,
    path,
  });

  const result = await cleanup.cleanup({
    logRetentionDays: undefined,
    workspaceRoot: "/tmp/unused",
  });

  assert.deepEqual(result, {
    enabled: false,
    inspected: 0,
    removed: 0,
    removedLinks: 0,
  });
});
