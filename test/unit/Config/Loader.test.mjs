import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Github_Flows_App_Config_Loader from "../../../src/Config/Loader.mjs";

test("Config loader reads env files and maps runtime params", async () => {
  const calls = [];
  const loader = new Github_Flows_App_Config_Loader({
    fs,
    path,
    appCfgRuntimeFactory: {
      configure(params) {
        calls.push(["configure", params]);
      },
      freeze() {
        calls.push(["freeze"]);
      },
    },
  });
  const dir = await mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
  try {
    await writeFile(path.join(dir, ".env"), "HOST=0.0.0.0\nPORT=8080\nWORKSPACE_ROOT=/tmp/work\nRUNTIME_IMAGE=img\nWEBHOOK_SECRET=secret\n");
    assert.deepEqual(await loader.load({ projectRoot: dir }), {
      httpHost: "0.0.0.0",
      httpPort: 8080,
      workspaceRoot: "/tmp/work",
      runtimeImage: "img",
      webhookSecret: "secret",
    });
    assert.deepEqual(calls, [
      ["configure", {
        httpHost: "0.0.0.0",
        httpPort: 8080,
        workspaceRoot: "/tmp/work",
        runtimeImage: "img",
        webhookSecret: "secret",
      }],
      ["freeze"],
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Config loader falls back to code defaults without env file", async () => {
  const calls = [];
  const loader = new Github_Flows_App_Config_Loader({
    fs,
    path,
    appCfgRuntimeFactory: {
      configure(params) {
        calls.push(["configure", params]);
      },
      freeze() {
        calls.push(["freeze"]);
      },
    },
  });
  const dir = await mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
  try {
    assert.deepEqual(await loader.load({ projectRoot: dir }), {
      httpHost: "127.0.0.1",
      httpPort: 3000,
      workspaceRoot: `${dir}/var/work`,
      runtimeImage: "codex-agent",
      webhookSecret: "replace-with-shared-secret",
    });
    assert.deepEqual(calls, [
      ["configure", {
        httpHost: "127.0.0.1",
        httpPort: 3000,
        workspaceRoot: `${dir}/var/work`,
        runtimeImage: "codex-agent",
        webhookSecret: "replace-with-shared-secret",
      }],
      ["freeze"],
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
