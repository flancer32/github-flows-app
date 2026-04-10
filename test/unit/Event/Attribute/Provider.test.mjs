import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_App_Event_Attribute_Provider from "../../../../src/Event/Attribute/Provider.mjs";

test("Event attribute provider returns host application name", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({
  });

  const resultOne = await provider.getAttributes({
    headers: {},
    loggingContext: undefined,
    payload: {},
  });
  const resultTwo = await provider.getAttributes({
    headers: {},
    loggingContext: undefined,
    payload: {},
  });

  assert.deepEqual(resultOne, {
    sizeLess10K: true,
    sizeLess100K: true,
    sizeLess1M: true,
    sizeLess2M: true,
  });
  assert.deepEqual(resultTwo, {
    sizeLess10K: true,
    sizeLess100K: true,
    sizeLess1M: true,
    sizeLess2M: true,
  });
});

test("Event attribute provider sets size flags from payload length", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    payload: "x".repeat(12_000),
  });

  assert.equal(result.sizeLess10K, false);
  assert.equal(result.sizeLess100K, true);
  assert.equal(result.sizeLess1M, true);
  assert.equal(result.sizeLess2M, true);
});
