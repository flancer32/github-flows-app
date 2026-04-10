import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_App_Bootstrap from "../../src/Bootstrap.mjs";

test("App exposes run and stop methods", async () => {
  const calls = [];
  const attributeProvider = {};
  const staticHandler = {
    async init(params) {
      calls.push(["init", params]);
    },
  };
  const app = new Github_Flows_App_Bootstrap({
    appCfgRuntimeLoader: {
      load({ projectRoot }) {
        calls.push(["load", projectRoot]);
        return {
          httpHost: "127.0.0.1",
          httpPort: 3000,
          workspaceRoot: `${projectRoot}/var/work`,
          runtimeImage: "codex-agent",
          webhookSecret: "replace-with-shared-secret",
        };
      },
    },
    appEventAttributeProviderHolder: {
      set(provider) {
        calls.push(["setProvider", provider]);
      },
    },
    appEventAttributeProvider: attributeProvider,
    appWebServer: {
      async start() {
        calls.push(["start"]);
      },
      async stop() {
        calls.push(["stop"]);
      },
    },
    appWebPipelineEngine: {
      addHandler(handler) {
        calls.push(["addHandler", handler]);
      },
    },
    appWebStaticHandler: staticHandler,
    appWebSourceFactory: {
      create(params) {
        calls.push(["create", params]);
        return { params };
      },
    },
  });

  assert.equal(typeof app.run, "function");
  assert.equal(typeof app.stop, "function");

  const runPromise = app.run({ projectRoot: "/tmp/project", cliArgs: ["--flag"] });
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(calls, [
    ["load", "/tmp/project"],
    ["setProvider", attributeProvider],
    ["create", {
      root: "/tmp/project/web",
      prefix: "/",
      allow: {
        ".": ["."],
      },
      defaults: ["index.html"],
    }],
    ["init", {
      sources: [{
        params: {
          root: "/tmp/project/web",
          prefix: "/",
          allow: {
            ".": ["."],
          },
          defaults: ["index.html"],
        },
      }],
    }],
    ["addHandler", staticHandler],
    ["start"],
  ]);

  await app.stop();
  const exitCode = await runPromise;
  assert.equal(exitCode, 0);
  assert.deepEqual(calls.at(-1), ["stop"]);
});
