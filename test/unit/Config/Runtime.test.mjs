import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_App_Config_Runtime, { Factory } from "../../../src/Config/Runtime.mjs";

test("Config runtime exposes defaults and becomes immutable after freeze", () => {
  const calls = [];
  const githubFlowsRuntime = Object.freeze({
    httpHost: "127.0.0.1",
    httpPort: 3000,
    workspaceRoot: "/tmp/work",
    logRetentionDays: 7,
    webhookSecret: "secret",
  });
  const factory = new Factory({
    githubFlowsRuntimeFactory: {
      configure(params) {
        calls.push(["configure", params]);
      },
      freeze() {
        calls.push(["freeze"]);
        return githubFlowsRuntime;
      },
    },
  });
  const runtime = new Github_Flows_App_Config_Runtime();

  assert.throws(() => runtime.httpHost, /not initialized/i);

  factory.configure({
    workspaceRoot: "/tmp/work",
    logRetentionDays: 7,
    webhookSecret: "secret",
  });
  const frozenRuntime = factory.freeze();

  assert.equal(frozenRuntime, runtime);
  assert.equal(runtime.httpHost, "127.0.0.1");
  assert.equal(runtime.httpPort, 3000);
  assert.equal(runtime.workspaceRoot, "/tmp/work");
  assert.equal(runtime.logRetentionDays, 7);
  assert.equal(runtime.webhookSecret, "secret");
  assert.equal(runtime.githubFlowsRuntime, githubFlowsRuntime);
  assert.deepEqual(calls, [
    ["configure", {
      httpHost: "127.0.0.1",
      httpPort: 3000,
      workspaceRoot: "/tmp/work",
      webhookSecret: "secret",
    }],
    ["freeze"],
  ]);
  assert.equal(factory.freeze(), runtime);
  assert.throws(() => {
    runtime.httpHost = "0.0.0.0";
  }, /immutable/i);
});
