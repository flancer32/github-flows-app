import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_App_Bootstrap from "../../src/Bootstrap.mjs";

test("App exposes run and stop methods", async () => {
  const calls = [];
  const attributeProvider = {
    async getAttributes() {
      throw new Error("Provider must not be evaluated during bootstrap.");
    },
  };
  const staticHandler = {
    async init(params) {
      calls.push(["init", params]);
    },
  };
  const logRetentionScheduler = {
    async start(params) {
      calls.push(["scheduler:start", params]);
    },
    async stop() {
      calls.push(["scheduler:stop"]);
    },
  };
  const webhookHandler = {};
  const app = new Github_Flows_App_Bootstrap({
    appCfgRuntimeLoader: {
      load({ projectRoot }) {
        calls.push(["load", projectRoot]);
        return {
          httpHost: "127.0.0.1",
          httpPort: 3000,
          workspaceRoot: `${projectRoot}/var/work`,
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
    appLogRetentionScheduler: logRetentionScheduler,
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
    appWebhookHandler: webhookHandler,
  });

  assert.equal(typeof app.run, "function");
  assert.equal(typeof app.stop, "function");

  const runPromise = app.run({ projectRoot: "/tmp/project", cliArgs: ["--flag"] });
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(calls, [
    ["load", "/tmp/project"],
    ["setProvider", attributeProvider],
    ["addHandler", webhookHandler],
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
    ["scheduler:start", {
      logRetentionDays: undefined,
      workspaceRoot: "/tmp/project/var/work",
    }],
    ["start"],
  ]);

  await app.stop();
  const exitCode = await runPromise;
  assert.equal(exitCode, 0);
  assert.deepEqual(calls.at(-2), ["scheduler:stop"]);
  assert.deepEqual(calls.at(-1), ["stop"]);
});

test("App redacts webhookSecret in bootstrap runtime trace", async () => {
  const calls = [];
  const infoCalls = [];
  const originalInfo = console.info;
  console.info = (...args) => {
    infoCalls.push(args);
  };

  try {
    const app = new Github_Flows_App_Bootstrap({
      appCfgRuntimeLoader: {
        load() {
          return {
            httpHost: "127.0.0.1",
            httpPort: 3000,
            workspaceRoot: "/tmp/project/var/work",
            webhookSecret: "replace-with-shared-secret",
          };
        },
      },
      appEventAttributeProviderHolder: {
        set() {
          calls.push(["setProvider"]);
        },
      },
      appEventAttributeProvider: {},
      appLogRetentionScheduler: {
        async start(params) {
          calls.push(["scheduler:start", params]);
        },
        async stop() {
          calls.push(["scheduler:stop"]);
        },
      },
      appWebServer: {
        async start() {
          calls.push(["start"]);
        },
        async stop() {
          calls.push(["stop"]);
        },
      },
      appWebPipelineEngine: {
        addHandler() {},
      },
      appWebStaticHandler: {
        async init() {},
      },
      appWebSourceFactory: {
        create() {
          return {};
        },
      },
      appWebhookHandler: {},
    });

    const runPromise = app.run({ projectRoot: "/tmp/project", cliArgs: [] });
    await new Promise(resolve => setImmediate(resolve));
    await app.stop();
    await runPromise;
  } finally {
    console.info = originalInfo;
  }

  const runtimeTrace = infoCalls.find(args => args[0] === "[bootstrap] runtime:configured");
  assert.ok(runtimeTrace);
  assert.deepEqual(runtimeTrace[1], {
    httpHost: "127.0.0.1",
    httpPort: 3000,
    workspaceRoot: "/tmp/project/var/work",
    webhookSecret: "[redacted]",
  });
  assert.ok(infoCalls.every(args => !JSON.stringify(args).includes("replace-with-shared-secret")));
});
