import assert from "node:assert/strict";
import test from "node:test";

import Fl32_Web_Back_Helper_Order_Kahn from "../../../node_modules/@flancer32/teq-web/src/Back/Helper/Order/Kahn.mjs";
import Fl32_Web_Back_PipelineEngine from "../../../node_modules/@flancer32/teq-web/src/Back/PipelineEngine.mjs";

const STAGE = Object.freeze({
  FINALIZE: "FINALIZE",
  INIT: "INIT",
  PROCESS: "PROCESS",
});

const createResponse = () => ({
  body: "",
  headers: undefined,
  headersSent: false,
  statusCode: undefined,
  writableEnded: false,
  end(body = "") {
    this.body += body;
    this.headersSent = true;
    this.writableEnded = true;
  },
  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = headers;
    this.headersSent = true;
  },
});

const createPipeline = () => new Fl32_Web_Back_PipelineEngine({
  STAGE,
  dtoRequestContextFactory: {
    create() {
      return {};
    },
  },
  helpOrder: new Fl32_Web_Back_Helper_Order_Kahn(),
  logger: {
    error() {},
    exception(error) {
      throw error;
    },
  },
  respond: {
    code404_NotFound({ res }) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    },
    code500_InternalServerError({ res, body }) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(body);
    },
    isWritable(res) {
      return !res.writableEnded;
    },
  },
});

const createProcessHandler = ({ calls, handle, name }) => ({
  getRegistrationInfo() {
    return {
      after: [],
      before: [],
      name,
      stage: STAGE.PROCESS,
    };
  },
  async handle(context) {
    calls.push(name);
    await handle(context);
  },
});

test("Webhook handler completes webhook requests before static handler", async () => {
  const calls = [];
  const pipeline = createPipeline();
  const webhookHandler = createProcessHandler({
    calls,
    name: "Github_Flows_Web_Handler_Webhook",
    handle(context) {
      if (context.request.url === "/webhooks/github") {
        context.response.writeHead(202, { "Content-Type": "application/json; charset=utf-8" });
        context.response.end(JSON.stringify({ status: "accepted" }));
        context.complete();
      }
    },
  });
  const staticHandler = createProcessHandler({
    calls,
    name: "Fl32_Web_Back_Handler_Static",
    handle(context) {
      context.response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      context.response.end("static");
      context.complete();
    },
  });

  pipeline.addHandler(webhookHandler);
  pipeline.addHandler(staticHandler);
  pipeline.addHandler(webhookHandler);

  const response = createResponse();
  await pipeline.handleRequest({ url: "/webhooks/github" }, response);

  assert.deepEqual(calls, ["Github_Flows_Web_Handler_Webhook"]);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body, '{"status":"accepted"}');
});

test("Static handler remains available for non-webhook requests", async () => {
  const calls = [];
  const pipeline = createPipeline();
  const webhookHandler = createProcessHandler({
    calls,
    name: "Github_Flows_Web_Handler_Webhook",
    handle() {},
  });
  const staticHandler = createProcessHandler({
    calls,
    name: "Fl32_Web_Back_Handler_Static",
    handle(context) {
      if (context.request.url === "/") {
        context.response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        context.response.end("<!doctype html>");
        context.complete();
      }
    },
  });

  pipeline.addHandler(webhookHandler);
  pipeline.addHandler(staticHandler);

  const response = createResponse();
  await pipeline.handleRequest({ url: "/" }, response);

  assert.deepEqual(calls, ["Github_Flows_Web_Handler_Webhook", "Fl32_Web_Back_Handler_Static"]);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "<!doctype html>");
});

test("Pipeline returns 404 when no process handler completes request", async () => {
  const calls = [];
  const pipeline = createPipeline();
  pipeline.addHandler(createProcessHandler({
    calls,
    name: "Github_Flows_Web_Handler_Webhook",
    handle() {},
  }));
  pipeline.addHandler(createProcessHandler({
    calls,
    name: "Fl32_Web_Back_Handler_Static",
    handle() {},
  }));

  const response = createResponse();
  await pipeline.handleRequest({ url: "/missing" }, response);

  assert.deepEqual(calls, ["Github_Flows_Web_Handler_Webhook", "Fl32_Web_Back_Handler_Static"]);
  assert.equal(response.statusCode, 404);
  assert.equal(response.body, "Not Found");
});
