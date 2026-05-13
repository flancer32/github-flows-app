import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Github_Flows_App_Bootstrap from "../../src/Bootstrap.mjs";
import Github_Flows_App_Event_Attribute_Provider from "../../src/Event/Attribute/Provider.mjs";

const assertSizeAttributeShape = result => {
  assert.deepEqual(Object.keys(result).sort(), [
    "sizeLess100K",
    "sizeLess10K",
    "sizeLess1M",
    "sizeLess2M",
  ].sort());
  for (const value of Object.values(result)) {
    assert.equal(typeof value, "boolean");
  }
};

const createBootstrapDeps = ({ attributeProvider, onSetProvider }) => ({
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

test("Bootstrap registers the real event attribute provider without evaluating it", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider();
  const originalGetAttributes = provider.getAttributes;
  let getAttributesCalls = 0;
  let capturedProvider;

  provider.getAttributes = async params => {
    getAttributesCalls += 1;
    return originalGetAttributes.call(provider, params);
  };

  const app = new Github_Flows_App_Bootstrap(createBootstrapDeps({
    attributeProvider: provider,
    onSetProvider(nextProvider) {
      capturedProvider = nextProvider;
    },
  }));

  const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
  const runPromise = app.run({ projectRoot, cliArgs: [] });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(capturedProvider, provider);
  assert.equal(capturedProvider instanceof Github_Flows_App_Event_Attribute_Provider, true);
  assert.equal(typeof capturedProvider.getAttributes, "function");
  assert.equal(getAttributesCalls, 0);

  await app.stop();
  const exitCode = await runPromise;
  assert.equal(exitCode, 0);
  assert.equal(getAttributesCalls, 0);
});

test("Registered real event attribute provider returns documented plain size attributes", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider();
  let capturedProvider;

  const app = new Github_Flows_App_Bootstrap(createBootstrapDeps({
    attributeProvider: provider,
    onSetProvider(nextProvider) {
      capturedProvider = nextProvider;
    },
  }));

  const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
  const runPromise = app.run({ projectRoot, cliArgs: [] });
  await new Promise(resolve => setImmediate(resolve));
  await app.stop();
  const exitCode = await runPromise;

  assert.equal(exitCode, 0);
  assert.equal(capturedProvider, provider);

  const smallPayload = {
    action: "opened",
    issue: {
      number: 1,
      title: "Test issue",
      body: "short body",
      labels: [],
    },
    repository: {
      full_name: "owner/repo",
    },
    sender: {
      login: "tester",
    },
  };
  const largePayload = {
    ...smallPayload,
    extra: "x".repeat(12_000),
  };

  const smallResult = await capturedProvider.getAttributes({ payload: smallPayload });
  const largeResult = await capturedProvider.getAttributes({ payload: largePayload });

  assertSizeAttributeShape(smallResult);
  assertSizeAttributeShape(largeResult);
  assert.deepEqual(smallResult, {
    sizeLess10K: true,
    sizeLess100K: true,
    sizeLess1M: true,
    sizeLess2M: true,
  });
  assert.deepEqual(largeResult, {
    sizeLess10K: false,
    sizeLess100K: true,
    sizeLess1M: true,
    sizeLess2M: true,
  });
});
