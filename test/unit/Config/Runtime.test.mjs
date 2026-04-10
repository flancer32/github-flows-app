import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_App_Config_Runtime, { Factory } from "../../../src/Config/Runtime.mjs";

test("Config runtime exposes defaults and becomes immutable after freeze", () => {
  const factory = new Factory();
  const runtime = new Github_Flows_App_Config_Runtime();

  assert.throws(() => runtime.httpHost, /not initialized/i);

  factory.configure({
    workspaceRoot: "/tmp/work",
    runtimeImage: "codex-agent",
    webhookSecret: "secret",
  });
  factory.freeze();

  assert.equal(runtime.httpHost, "127.0.0.1");
  assert.equal(runtime.httpPort, 3000);
  assert.equal(runtime.workspaceRoot, "/tmp/work");
  assert.equal(runtime.runtimeImage, "codex-agent");
  assert.equal(runtime.webhookSecret, "secret");
  assert.throws(() => {
    runtime.httpHost = "0.0.0.0";
  }, /immutable/i);
});
