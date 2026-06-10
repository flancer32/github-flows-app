// @ts-check

/**
 * @namespace Github_Flows_App_Config_Runtime
 * @description Runtime configuration data for github-flows-app.
 */
export class Data {
  /** @type {string|undefined} */
  httpHost;

  /** @type {number|undefined} */
  httpPort;

  /** @type {Github_Flows_Config_Runtime|undefined} */
  githubFlowsRuntime;

  /** @type {string|undefined} */
  workspaceRoot;

  /** @type {number|undefined} */
  logRetentionDays;

  /** @type {string|undefined} */
  webhookSecret;
}

/** @type {Data} */
const cfg = new Data();

const facade = {};
let initialized = false;
const proxy = new Proxy(facade, {
  get(_target, prop) {
    const isServiceProp = prop === "then" || typeof prop === "symbol";
    if (!initialized && !isServiceProp) {
      throw new Error("Runtime configuration is not initialized.");
    }
    return Reflect.get(cfg, prop);
  },
  set() { throw new Error("Runtime configuration is immutable."); },
  defineProperty() { throw new Error("Runtime configuration wrapper is immutable."); },
  deleteProperty() { throw new Error("Runtime configuration wrapper is immutable."); },
  preventExtensions() { throw new Error("Runtime configuration wrapper cannot be frozen."); },
});

/**
 * @namespace Github_Flows_App_Config_Runtime__Factory
 * @description Runtime configuration factory.
 */
export class Factory {
  /**
   * @param {object} deps
   * @param {Github_Flows_Config_Runtime__Factory} deps.githubFlowsRuntimeFactory
   */
  constructor({ githubFlowsRuntimeFactory }) {
    let frozen = false;
    this.configure = function (params = {}) {
      if (frozen) {
        throw new Error("Runtime configuration is already frozen.");
      }
      if (params.httpHost !== undefined && cfg.httpHost === undefined) cfg.httpHost = params.httpHost;
      if (params.httpPort !== undefined && cfg.httpPort === undefined) cfg.httpPort = params.httpPort;
      if (params.workspaceRoot !== undefined && cfg.workspaceRoot === undefined) cfg.workspaceRoot = params.workspaceRoot;
      if (params.logRetentionDays !== undefined && cfg.logRetentionDays === undefined) cfg.logRetentionDays = params.logRetentionDays;
      if (params.webhookSecret !== undefined && cfg.webhookSecret === undefined) cfg.webhookSecret = params.webhookSecret;
    };
    this.freeze = function () {
      if (frozen) return proxy;
      if (cfg.httpHost === undefined) cfg.httpHost = "127.0.0.1";
      if (cfg.httpPort === undefined) cfg.httpPort = 3000;
      if (cfg.workspaceRoot === undefined) throw new Error("Missing required runtime configuration field: workspaceRoot");
      if (cfg.webhookSecret === undefined) throw new Error("Missing required runtime configuration field: webhookSecret");
      githubFlowsRuntimeFactory.configure({
        httpHost: cfg.httpHost,
        httpPort: cfg.httpPort,
        workspaceRoot: cfg.workspaceRoot,
        webhookSecret: cfg.webhookSecret,
      });
      cfg.githubFlowsRuntime = githubFlowsRuntimeFactory.freeze();
      frozen = true;
      Object.freeze(cfg);
      initialized = true;
      return proxy;
    };
  }
}

/**
 * Runtime configuration wrapper.
 */
export default class Wrapper {
  constructor() {
    return proxy;
  }
}

Object.freeze(Data.prototype);
Object.freeze(Factory.prototype);
Object.freeze(Wrapper.prototype);

export const __deps__ = Object.freeze({
  Factory: Object.freeze({
    githubFlowsRuntimeFactory: "Github_Flows_Config_Runtime__Factory$",
  }),
});
