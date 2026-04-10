import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Github_Flows_App_Bootstrap from "../../src/Bootstrap.mjs";

test("App module can be imported and executed", async () => {
  const app = new Github_Flows_App_Bootstrap({
    appCfgRuntimeLoader: {
      load({ projectRoot }) {
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
      set() {},
    },
    appEventAttributeProvider: {
      async getAttributes() {
        return {};
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
    appWebServer: {
      async start() {},
      async stop() {},
    },
  });

  const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
  const runPromise = app.run({ projectRoot, cliArgs: [] });
  await new Promise(resolve => setImmediate(resolve));

  await app.stop();
  const exitCode = await runPromise;
  assert.equal(exitCode, 0);
});
