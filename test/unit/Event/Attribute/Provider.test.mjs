import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_App_Event_Attribute_Provider from "../../../../src/Event/Attribute/Provider.mjs";

const expectedSizeAttributes = {
  sizeLess10K: true,
  sizeLess100K: true,
  sizeLess1M: true,
  sizeLess2M: true,
};

const assertSizeAttributeShape = result => {
  assert.deepEqual(Object.keys(result).sort(), Object.keys(expectedSizeAttributes).sort());
  for (const value of Object.values(result)) {
    assert.equal(typeof value, "boolean");
  }
};

test("Event attribute provider returns documented size attributes for an empty payload", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

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

  assertSizeAttributeShape(resultOne);
  assertSizeAttributeShape(resultTwo);
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

test("Event attribute provider treats missing payload as zero-size input", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const resultWithoutParams = await provider.getAttributes();
  const resultWithoutPayload = await provider.getAttributes({});

  assertSizeAttributeShape(resultWithoutParams);
  assertSizeAttributeShape(resultWithoutPayload);
  assert.deepEqual(resultWithoutParams, expectedSizeAttributes);
  assert.deepEqual(resultWithoutPayload, expectedSizeAttributes);
});

test("Event attribute provider uses strict less-than size thresholds", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});
  const cases = [
    [0, true, true, true, true],
    [9_999, true, true, true, true],
    [10_000, false, true, true, true],
    [99_999, false, true, true, true],
    [100_000, false, false, true, true],
    [999_999, false, false, true, true],
    [1_000_000, false, false, false, true],
    [1_999_999, false, false, false, true],
    [2_000_000, false, false, false, false],
  ];

  for (const [size, sizeLess10K, sizeLess100K, sizeLess1M, sizeLess2M] of cases) {
    const result = await provider.getAttributes({ payload: "x".repeat(size) });

    assertSizeAttributeShape(result);
    assert.deepEqual(
      result,
      { sizeLess10K, sizeLess100K, sizeLess1M, sizeLess2M },
      `Expected strict threshold flags for ${size} bytes`,
    );
  }
});

test("Event attribute provider measures the serialized full payload, not only issue body", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    payload: {
      issue: {
        body: "short",
      },
      repository: {
        full_name: "owner/repo",
      },
      extra: "x".repeat(12_000),
    },
  });

  assertSizeAttributeShape(result);
  assert.equal(result.sizeLess10K, false);
  assert.equal(result.sizeLess100K, true);
  assert.equal(result.sizeLess1M, true);
  assert.equal(result.sizeLess2M, true);
});

test("Event attribute provider currently consumes only payload", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});
  const payload = {
    issue: {
      body: "same payload",
    },
  };

  const resultOne = await provider.getAttributes({
    headers: { "x-github-event": "issues" },
    eventModel: { action: "opened" },
    loggingContext: { requestId: "one" },
    payload,
  });
  const resultTwo = await provider.getAttributes({
    headers: { "x-github-event": "pull_request" },
    eventModel: { action: "closed" },
    loggingContext: { requestId: "two" },
    payload,
  });

  assertSizeAttributeShape(resultOne);
  assertSizeAttributeShape(resultTwo);
  assert.deepEqual(resultOne, resultTwo);
});
