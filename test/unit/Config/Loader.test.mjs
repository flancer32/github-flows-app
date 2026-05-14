import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Github_Flows_App_Config_Loader from "../../../src/Config/Loader.mjs";

const createLoader = ({ calls = [] } = {}) => {
  let runtime;
  return new Github_Flows_App_Config_Loader({
    fs,
    path,
    appCfgRuntimeFactory: {
      configure(params) {
        calls.push(["configure", params]);
        runtime = Object.freeze({ ...params });
      },
      freeze() {
        calls.push(["freeze"]);
        return runtime;
      },
    },
  });
};

test("Config loader reads env files and maps runtime params", async () => {
  const calls = [];
  const runtime = Object.freeze({
    httpHost: "0.0.0.0",
    httpPort: 8080,
    workspaceRoot: "/tmp/work",
    webhookSecret: "secret",
  });
  const loader = new Github_Flows_App_Config_Loader({
    fs,
    path,
    appCfgRuntimeFactory: {
      configure(params) {
        calls.push(["configure", params]);
      },
      freeze() {
        calls.push(["freeze"]);
        return runtime;
      },
    },
  });
  const dir = await mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
  try {
    await writeFile(path.join(dir, ".env"), "HOST=0.0.0.0\nPORT=8080\nWORKSPACE_ROOT=/tmp/work\nWEBHOOK_SECRET=secret\n");
    assert.equal(await loader.load({ projectRoot: dir }), runtime);
    assert.deepEqual(calls, [
      ["configure", {
        httpHost: "0.0.0.0",
        httpPort: 8080,
        workspaceRoot: "/tmp/work",
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
  let runtime;
  const loader = new Github_Flows_App_Config_Loader({
    fs,
    path,
    appCfgRuntimeFactory: {
      configure(params) {
        calls.push(["configure", params]);
        runtime = Object.freeze({ ...params });
      },
      freeze() {
        calls.push(["freeze"]);
        return runtime;
      },
    },
  });
  const dir = await mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
  try {
    assert.deepEqual(await loader.load({ projectRoot: dir }), {
      httpHost: "127.0.0.1",
      httpPort: 3000,
      workspaceRoot: `${dir}/var/work`,
      webhookSecret: "replace-with-shared-secret",
    });
    assert.deepEqual(calls, [
      ["configure", {
        httpHost: "127.0.0.1",
        httpPort: 3000,
        workspaceRoot: `${dir}/var/work`,
        webhookSecret: "replace-with-shared-secret",
      }],
      ["freeze"],
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Config loader parses quoted env values and ignores malformed lines", async () => {
  const calls = [];
  const loader = createLoader({ calls });
  const dir = await mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
  try {
    await writeFile(
      path.join(dir, ".env"),
      [
        "# comment",
        "MALFORMED",
        "HOST='0.0.0.0'",
        'PORT="8080"',
        "WORKSPACE_ROOT='/tmp/quoted work'",
        'WEBHOOK_SECRET="quoted-secret"',
        "",
      ].join("\n"),
    );

    assert.deepEqual(await loader.load({ projectRoot: dir }), {
      httpHost: "0.0.0.0",
      httpPort: 8080,
      workspaceRoot: "/tmp/quoted work",
      webhookSecret: "quoted-secret",
    });
    assert.deepEqual(calls, [
      ["configure", {
        httpHost: "0.0.0.0",
        httpPort: 8080,
        workspaceRoot: "/tmp/quoted work",
        webhookSecret: "quoted-secret",
      }],
      ["freeze"],
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Config loader rejects invalid PORT", async () => {
  const calls = [];
  const loader = createLoader({ calls });
  const dir = await mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
  try {
    await writeFile(path.join(dir, ".env"), "PORT=abc\nWEBHOOK_SECRET=secret\n");

    await assert.rejects(
      () => loader.load({ projectRoot: dir }),
      /PORT/i,
    );
    assert.deepEqual(calls, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Config loader rejects empty required values", async () => {
  const cases = [
    ["WORKSPACE_ROOT=", /WORKSPACE_ROOT/i],
    ["WEBHOOK_SECRET=", /WEBHOOK_SECRET/i],
  ];

  for (const [content, expectedError] of cases) {
    const calls = [];
    const loader = createLoader({ calls });
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
    try {
      await writeFile(path.join(dir, ".env"), content);

      await assert.rejects(
        () => loader.load({ projectRoot: dir }),
        expectedError,
      );
      assert.deepEqual(calls, []);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
