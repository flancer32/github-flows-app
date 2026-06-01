import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Github_Flows_Execution_Profile_Resolver from "../../../../node_modules/@teqfw/github-flows/src/Execution/Profile/Resolver.mjs";

const createResolver = workspaceRoot => new Github_Flows_Execution_Profile_Resolver({
  fsPromises: fs,
  logger: undefined,
  pathModule: path,
  runtime: {
    workspaceRoot,
  },
});

const writeProfile = async (dir, relativePath, profile) => {
  const absoluteDir = path.join(dir, relativePath);
  await fs.mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, "profile.json"), `${JSON.stringify(profile, null, 2)}\n`);
  await writeFile(path.join(absoluteDir, "prompt.md"), "Prompt placeholder.\n");
};

test("Execution profile resolver selects the normal issues.opened profile only when issueAuthorRequestedNoAgent is false", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
  try {
    await writeProfile(workspaceRoot, "cfg", {
      trigger: {
        event: "issues",
        action: "opened",
        repository: "owner/repo",
        issueAuthorRequestedNoAgent: false,
      },
      execution: {
        handler: {
          promptRef: "prompt.md",
        },
      },
    });

    const resolver = createResolver(workspaceRoot);
    const selectedWhenFalse = await resolver.resolveByEventAttributes({
      eventAttributes: {
        event: "issues",
        action: "opened",
        repository: "owner/repo",
        issueAuthorRequestedNoAgent: false,
      },
    });
    const selectedWhenTrue = await resolver.resolveByEventAttributes({
      eventAttributes: {
        event: "issues",
        action: "opened",
        repository: "owner/repo",
        issueAuthorRequestedNoAgent: true,
      },
    });
    const selectedWhenMissing = await resolver.resolveByEventAttributes({
      eventAttributes: {
        event: "issues",
        action: "opened",
        repository: "owner/repo",
      },
    });

    assert.deepEqual(selectedWhenFalse.selectedProfile?.trigger, {
      event: "issues",
      action: "opened",
      repository: "owner/repo",
      issueAuthorRequestedNoAgent: false,
    });
    assert.equal(selectedWhenTrue.selectedProfile, null);
    assert.equal(selectedWhenMissing.selectedProfile, null);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("Execution profile resolver keeps issues.labeled profile selection unchanged", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "github-flows-app-"));
  try {
    await writeProfile(workspaceRoot, "cfg", {
      execution: {
        handler: {
          promptRef: "prompt.md",
        },
      },
    });
    await writeProfile(workspaceRoot, "cfg/issues-opened", {
      trigger: {
        event: "issues",
        action: "opened",
        repository: "owner/repo",
        issueAuthorRequestedNoAgent: false,
      },
      execution: {
        handler: {
          promptRef: "prompt.md",
        },
      },
    });
    await writeProfile(workspaceRoot, "cfg/issues-labeled", {
      trigger: {
        event: "issues",
        action: "labeled",
        repository: "owner/repo",
        issueLabelAdded: "adsm:no-agent",
      },
      execution: {
        handler: {
          promptRef: "prompt.md",
        },
      },
    });

    const resolver = createResolver(workspaceRoot);
    const result = await resolver.resolveByEventAttributes({
      eventAttributes: {
        event: "issues",
        action: "labeled",
        repository: "owner/repo",
        issueLabelAdded: "adsm:no-agent",
        issueAuthorRequestedNoAgent: true,
      },
    });

    assert.deepEqual(result.selectedProfile?.trigger, {
      event: "issues",
      action: "labeled",
      repository: "owner/repo",
      issueLabelAdded: "adsm:no-agent",
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
