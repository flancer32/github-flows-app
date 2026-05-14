import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import test from "node:test";

import Container from "@teqfw/di/src/Container.mjs";
import NamespaceRegistry from "@teqfw/di/src/Config/NamespaceRegistry.mjs";

import Github_Flows_App_Bootstrap from "../../src/Bootstrap.mjs";

const createContainer = async () => {
  const projectRoot = process.cwd();
  const container = new Container();
  const namespaceRegistry = new NamespaceRegistry({ fs, path, appRoot: projectRoot });
  const entries = await namespaceRegistry.build();

  for (const entry of entries) {
    container.addNamespaceRoot(entry.prefix, entry.dirAbs, entry.ext);
  }

  return { container, projectRoot };
};

const createBootstrapDeps = ({ calls, holder, provider }) => {
  const staticHandler = {
    async init(params) {
      calls.push(["static:init", params]);
    },
  };
  const webhookHandler = {
    getRegistrationInfo() {
      return {
        after: [],
        before: [],
        name: "Github_Flows_Web_Handler_Webhook",
        stage: "PROCESS",
      };
    },
  };

  return {
    appCfgRuntimeLoader: {
      async load({ projectRoot: nextProjectRoot }) {
        calls.push(["config:load", nextProjectRoot]);
        return {
          httpHost: "127.0.0.1",
          httpPort: 3000,
          workspaceRoot: `${nextProjectRoot}/var/work`,
          webhookSecret: "replace-with-shared-secret",
        };
      },
    },
    appEventAttributeProvider: provider,
    appEventAttributeProviderHolder: holder,
    appWebPipelineEngine: {
      addHandler(handler) {
        calls.push(["pipeline:addHandler", handler]);
      },
    },
    appWebServer: {
      async start() {
        calls.push(["server:start"]);
      },
      async stop() {
        calls.push(["server:stop"]);
      },
    },
    appWebSourceFactory: {
      create(params) {
        calls.push(["source:create", params]);
        return { params };
      },
    },
    appWebStaticHandler: staticHandler,
    appWebhookHandler: webhookHandler,
    staticHandler,
    webhookHandler,
  };
};

test("Bootstrap links real provider holder through DI and registers webhook before static", async () => {
  const calls = [];
  const { container, projectRoot } = await createContainer();
  const provider = await container.get("Github_Flows_App_Event_Attribute_Provider$");
  const providerHolder = await container.get("Github_Flows_Event_Attribute_Provider_Holder$");
  const deps = createBootstrapDeps({ calls, holder: providerHolder, provider });
  const app = new Github_Flows_App_Bootstrap(deps);

  const runPromise = app.run({ projectRoot, cliArgs: [] });
  await new Promise(resolve => setImmediate(resolve));

  let exitCode;
  let stopped = false;
  try {
    assert.equal(providerHolder.get()?.constructor?.name, "Github_Flows_App_Event_Attribute_Provider");
    assert.deepEqual(calls, [
      ["config:load", projectRoot],
      ["pipeline:addHandler", deps.webhookHandler],
      ["source:create", {
        root: `${projectRoot}/web`,
        prefix: "/",
        allow: {
          ".": ["."],
        },
        defaults: ["index.html"],
      }],
      ["static:init", {
        sources: [{
          params: {
            root: `${projectRoot}/web`,
            prefix: "/",
            allow: {
              ".": ["."],
            },
            defaults: ["index.html"],
          },
        }],
      }],
      ["pipeline:addHandler", deps.staticHandler],
      ["server:start"],
    ]);

    await app.stop();
    stopped = true;
    exitCode = await runPromise;
  } finally {
    if (!stopped) {
      await app.stop();
    }
  }

  assert.equal(exitCode, 0);
  assert.deepEqual(calls.at(-1), ["server:stop"]);
});
