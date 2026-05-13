import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Github_Flows_App_Bootstrap from "../../src/Bootstrap.mjs";

const createBootstrapDeps = ({ attributeProvider, onSetProvider = () => {} }) => ({
  appCfgRuntimeLoader: {
    load({ projectRoot }) {
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
      onSetProvider(provider);
    },
  },
  appEventAttributeProvider: attributeProvider,
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
  appWebServer: {
    async start() {},
    async stop() {},
  },
});

test("App module can be imported and executed", async () => {
  const app = new Github_Flows_App_Bootstrap(createBootstrapDeps({
    attributeProvider: {
      async getAttributes() {
        return {};
      },
    },
  }));

  const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
  const runPromise = app.run({ projectRoot, cliArgs: [] });
  await new Promise(resolve => setImmediate(resolve));

  await app.stop();
  const exitCode = await runPromise;
  assert.equal(exitCode, 0);
});
