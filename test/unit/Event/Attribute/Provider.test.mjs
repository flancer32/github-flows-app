import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_App_Event_Attribute_Provider from "../../../../src/Event/Attribute/Provider.mjs";

const expectedSizeAttributeNames = [
  "sizeLess10K",
  "sizeLess100K",
  "sizeLess1M",
  "sizeLess2M",
];

const expectedSizeAttributes = {
  sizeLess10K: true,
  sizeLess100K: true,
  sizeLess1M: true,
  sizeLess2M: true,
};

const issuesEventModel = Object.freeze({
  event: "issues",
});

const pullRequestEventModel = Object.freeze({
  event: "pull_request",
});

const assertSizeAttributesPresent = result => {
  for (const name of expectedSizeAttributeNames) {
    assert.equal(typeof result[name], "boolean");
  }
};

const assertSizeOnlyAttributeShape = result => {
  assert.deepEqual(Object.keys(result).sort(), expectedSizeAttributeNames.toSorted());
  assertSizeAttributesPresent(result);
};

const assertAttributeAbsent = (result, name) => {
  assert.equal(Object.hasOwn(result, name), false);
};

const assertPullRequestLabelAttributesAbsent = result => {
  assertAttributeAbsent(result, "pullRequestLabelAdded");
  assertAttributeAbsent(result, "pullRequestLabelRemoved");
};

const assertPullRequestAttributesAbsent = result => {
  assertPullRequestLabelAttributesAbsent(result);
  assertAttributeAbsent(result, "pullRequestMerged");
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

  assertSizeOnlyAttributeShape(resultOne);
  assertSizeOnlyAttributeShape(resultTwo);
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

  assertSizeOnlyAttributeShape(resultWithoutParams);
  assertSizeOnlyAttributeShape(resultWithoutPayload);
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

    assertSizeOnlyAttributeShape(result);
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

  assertSizeOnlyAttributeShape(result);
  assert.equal(result.sizeLess10K, false);
  assert.equal(result.sizeLess100K, true);
  assert.equal(result.sizeLess1M, true);
  assert.equal(result.sizeLess2M, true);
});

test("Event attribute provider derives attributes from payload rather than non-payload runtime parameters", async () => {
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

  assertSizeOnlyAttributeShape(resultOne);
  assertSizeOnlyAttributeShape(resultTwo);
  assert.deepEqual(resultOne, resultTwo);
});

test("Event attribute provider returns issueLabelAdded for issues.labeled payload", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "labeled",
      label: {
        name: "adsm",
      },
      issue: {
        number: 1,
      },
      repository: {
        full_name: "owner/repo",
      },
    },
  });

  assertSizeAttributesPresent(result);
  assert.equal(result.issueLabelAdded, "adsm");
  assertAttributeAbsent(result, "issueLabelRemoved");
  assertAttributeAbsent(result, "issueAddedLabel");
});

test("Event attribute provider returns issueLabelRemoved for issues.unlabeled payload", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "unlabeled",
      label: {
        name: "adsm",
      },
      issue: {
        number: 1,
      },
      repository: {
        full_name: "owner/repo",
      },
    },
  });

  assertSizeAttributesPresent(result);
  assert.equal(result.issueLabelRemoved, "adsm");
  assertAttributeAbsent(result, "issueLabelAdded");
  assertAttributeAbsent(result, "issueAddedLabel");
});

test("Event attribute provider omits issue label attributes for non-issues event model", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});
  const cases = [
    {
      eventModel: { event: "pull_request" },
      payload: {
        action: "labeled",
        label: {
          name: "adsm",
        },
        pull_request: {
          number: 1,
        },
      },
    },
    {
      eventModel: { event: "pull_request" },
      payload: {
        action: "unlabeled",
        label: {
          name: "adsm",
        },
        pull_request: {
          number: 1,
        },
      },
    },
    {
      eventModel: undefined,
      payload: {
        action: "labeled",
        label: {
          name: "adsm",
        },
        issue: {
          number: 1,
        },
      },
    },
  ];

  for (const { eventModel, payload } of cases) {
    const result = await provider.getAttributes({ eventModel, payload });

    assertSizeAttributesPresent(result);
    assertAttributeAbsent(result, "issueLabelAdded");
    assertAttributeAbsent(result, "issueLabelRemoved");
  }
});

test("Event attribute provider preserves exact added label string", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "labeled",
      label: {
        name: "ADSM Review",
      },
      issue: {
        number: 1,
      },
    },
  });

  assertSizeAttributesPresent(result);
  assert.equal(result.issueLabelAdded, "ADSM Review");
});

test("Event attribute provider preserves exact removed label string", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "unlabeled",
      label: {
        name: "ADSM Review",
      },
      issue: {
        number: 1,
      },
    },
  });

  assertSizeAttributesPresent(result);
  assert.equal(result.issueLabelRemoved, "ADSM Review");
});

test("Event attribute provider omits label attributes for non-label issue action", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "opened",
      label: {
        name: "adsm",
      },
      issue: {
        number: 1,
      },
    },
  });

  assertSizeOnlyAttributeShape(result);
  assertAttributeAbsent(result, "issueLabelAdded");
  assertAttributeAbsent(result, "issueLabelRemoved");
  assertAttributeAbsent(result, "issueAddedLabel");
});

test("Event attribute provider omits issueLabelAdded when label is missing", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "labeled",
      issue: {
        number: 1,
      },
    },
  });

  assertSizeAttributesPresent(result);
  assertAttributeAbsent(result, "issueLabelAdded");
  assertAttributeAbsent(result, "issueLabelRemoved");
});

test("Event attribute provider omits issueLabelRemoved when label is missing", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "unlabeled",
      issue: {
        number: 1,
      },
    },
  });

  assertSizeAttributesPresent(result);
  assertAttributeAbsent(result, "issueLabelRemoved");
  assertAttributeAbsent(result, "issueLabelAdded");
});

test("Event attribute provider omits label attributes when label.name is missing", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});
  const cases = [
    {
      action: "labeled",
      label: {},
      issue: {
        number: 1,
      },
    },
    {
      action: "unlabeled",
      label: {},
      issue: {
        number: 1,
      },
    },
  ];

  for (const payload of cases) {
    const result = await provider.getAttributes({ eventModel: issuesEventModel, payload });

    assertSizeAttributesPresent(result);
    assertAttributeAbsent(result, "issueLabelAdded");
    assertAttributeAbsent(result, "issueLabelRemoved");
  }
});

test("Event attribute provider omits label attributes when label.name is not a string", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});
  const cases = [
    {
      action: "labeled",
      label: {
        name: 123,
      },
      issue: {
        number: 1,
      },
    },
    {
      action: "labeled",
      label: {
        name: null,
      },
      issue: {
        number: 1,
      },
    },
    {
      action: "unlabeled",
      label: {
        name: 123,
      },
      issue: {
        number: 1,
      },
    },
    {
      action: "unlabeled",
      label: {
        name: null,
      },
      issue: {
        number: 1,
      },
    },
  ];

  for (const payload of cases) {
    const result = await provider.getAttributes({ eventModel: issuesEventModel, payload });

    assertSizeAttributesPresent(result);
    assertAttributeAbsent(result, "issueLabelAdded");
    assertAttributeAbsent(result, "issueLabelRemoved");
  }
});

test("Event attribute provider does not derive issueLabelAdded from payload.issue.labels", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "labeled",
      issue: {
        number: 1,
        labels: [
          { name: "adsm" },
        ],
      },
    },
  });

  assertSizeAttributesPresent(result);
  assertAttributeAbsent(result, "issueLabelAdded");
  assertAttributeAbsent(result, "issueLabelRemoved");
});

test("Event attribute provider does not derive issueLabelRemoved from absence in payload.issue.labels", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "unlabeled",
      issue: {
        number: 1,
        labels: [],
      },
      label: {
        name: undefined,
      },
    },
  });

  assertSizeAttributesPresent(result);
  assertAttributeAbsent(result, "issueLabelRemoved");
  assertAttributeAbsent(result, "issueLabelAdded");
});

test("Event attribute provider does not derive label attributes from issue labels on another action", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: issuesEventModel,
    payload: {
      action: "opened",
      issue: {
        number: 1,
        labels: [
          { name: "adsm" },
        ],
      },
    },
  });

  assertSizeOnlyAttributeShape(result);
  assertAttributeAbsent(result, "issueLabelAdded");
  assertAttributeAbsent(result, "issueLabelRemoved");
});

test("Event attribute provider returns pullRequestLabelAdded for pull_request.labeled payload", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: pullRequestEventModel,
    payload: {
      action: "labeled",
      label: {
        name: "ADSM Review: ready",
      },
      pull_request: {
        number: 1,
      },
      repository: {
        full_name: "owner/repo",
      },
    },
  });

  assertSizeAttributesPresent(result);
  assert.equal(result.pullRequestLabelAdded, "ADSM Review: ready");
  assertAttributeAbsent(result, "pullRequestLabelRemoved");
  assertAttributeAbsent(result, "pullRequestMerged");
  assertAttributeAbsent(result, "issueLabelAdded");
  assertAttributeAbsent(result, "issueLabelRemoved");
});

test("Event attribute provider returns pullRequestLabelRemoved for pull_request.unlabeled payload", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: pullRequestEventModel,
    payload: {
      action: "unlabeled",
      label: {
        name: "ADSM Review: ready",
      },
      pull_request: {
        number: 1,
      },
      repository: {
        full_name: "owner/repo",
      },
    },
  });

  assertSizeAttributesPresent(result);
  assert.equal(result.pullRequestLabelRemoved, "ADSM Review: ready");
  assertAttributeAbsent(result, "pullRequestLabelAdded");
  assertAttributeAbsent(result, "pullRequestMerged");
  assertAttributeAbsent(result, "issueLabelAdded");
  assertAttributeAbsent(result, "issueLabelRemoved");
});

test("Event attribute provider returns pullRequestMerged true for pull_request.closed payload", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: pullRequestEventModel,
    payload: {
      action: "closed",
      pull_request: {
        merged: true,
        number: 1,
      },
      repository: {
        full_name: "owner/repo",
      },
    },
  });

  assertSizeAttributesPresent(result);
  assert.equal(result.pullRequestMerged, true);
  assertPullRequestLabelAttributesAbsent(result);
});

test("Event attribute provider returns pullRequestMerged false for pull_request.closed payload", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: pullRequestEventModel,
    payload: {
      action: "closed",
      pull_request: {
        merged: false,
        number: 1,
      },
      repository: {
        full_name: "owner/repo",
      },
    },
  });

  assertSizeAttributesPresent(result);
  assert.equal(result.pullRequestMerged, false);
  assertPullRequestLabelAttributesAbsent(result);
});

test("Event attribute provider omits pull request label attributes for non-pull_request events", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});
  const cases = [
    {
      eventModel: { event: "issues" },
      payload: {
        action: "labeled",
        label: {
          name: "adsm",
        },
      },
    },
    {
      eventModel: { event: "check_run" },
      payload: {
        action: "unlabeled",
        label: {
          name: "adsm",
        },
      },
    },
    {
      eventModel: undefined,
      payload: {
        action: "labeled",
        label: {
          name: "adsm",
        },
      },
    },
  ];

  for (const { eventModel, payload } of cases) {
    const result = await provider.getAttributes({ eventModel, payload });

    assertSizeAttributesPresent(result);
    assertPullRequestLabelAttributesAbsent(result);
  }
});

test("Event attribute provider omits pull request label attributes when label.name is missing", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});
  const cases = [
    {
      action: "labeled",
      label: {},
      pull_request: {
        number: 1,
      },
    },
    {
      action: "unlabeled",
      label: {},
      pull_request: {
        number: 1,
      },
    },
    {
      action: "labeled",
      pull_request: {
        number: 1,
      },
    },
    {
      action: "unlabeled",
      pull_request: {
        number: 1,
      },
    },
  ];

  for (const payload of cases) {
    const result = await provider.getAttributes({ eventModel: pullRequestEventModel, payload });

    assertSizeOnlyAttributeShape(result);
    assertPullRequestLabelAttributesAbsent(result);
  }
});

test("Event attribute provider omits pull request label attributes when label.name is not a string", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});
  const cases = [
    {
      action: "labeled",
      label: {
        name: 123,
      },
      pull_request: {
        number: 1,
      },
    },
    {
      action: "labeled",
      label: {
        name: null,
      },
      pull_request: {
        number: 1,
      },
    },
    {
      action: "unlabeled",
      label: {
        name: 123,
      },
      pull_request: {
        number: 1,
      },
    },
    {
      action: "unlabeled",
      label: {
        name: null,
      },
      pull_request: {
        number: 1,
      },
    },
  ];

  for (const payload of cases) {
    const result = await provider.getAttributes({ eventModel: pullRequestEventModel, payload });

    assertSizeOnlyAttributeShape(result);
    assertPullRequestLabelAttributesAbsent(result);
  }
});

test("Event attribute provider omits pullRequestMerged when action is not closed", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});

  const result = await provider.getAttributes({
    eventModel: pullRequestEventModel,
    payload: {
      action: "opened",
      pull_request: {
        merged: true,
        number: 1,
      },
    },
  });

  assertSizeOnlyAttributeShape(result);
  assertPullRequestAttributesAbsent(result);
});

test("Event attribute provider omits pullRequestMerged when merged is not a boolean", async () => {
  const provider = new Github_Flows_App_Event_Attribute_Provider({});
  const cases = [
    {
      action: "closed",
      pull_request: {
        merged: "true",
      },
    },
    {
      action: "closed",
      pull_request: {},
    },
    {
      action: "closed",
    },
  ];

  for (const payload of cases) {
    const result = await provider.getAttributes({ eventModel: pullRequestEventModel, payload });

    assertSizeOnlyAttributeShape(result);
    assertPullRequestAttributesAbsent(result);
  }
});
