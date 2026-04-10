// @ts-check

/**
 * @namespace Github_Flows_App_Bootstrap
 * @description Application bootstrap component.
 */
export default class Github_Flows_App_Bootstrap {
  /**
   * @param {object} deps
   * @param {Github_Flows_App_Config_Loader} deps.appCfgRuntimeLoader
   * @param {Github_Flows_Event_Attribute_Provider_Holder} deps.appEventAttributeProviderHolder
   * @param {Github_Flows_App_Event_Attribute_Provider} deps.appEventAttributeProvider
   * @param {Github_Flows_Web_PipelineEngine} deps.appWebPipelineEngine
   * @param {Github_Flows_Web_Handler_Static} deps.appWebStaticHandler
   * @param {Github_Flows_Web_Dto_Source__Factory} deps.appWebSourceFactory
   * @param {Github_Flows_Web_Server} deps.appWebServer
  */
  constructor({
    appCfgRuntimeLoader,
    appEventAttributeProviderHolder,
    appEventAttributeProvider,
    appWebPipelineEngine,
    appWebStaticHandler,
    appWebSourceFactory,
    appWebServer,
  }) {
    /** @type {boolean} */
    let started = false;
    /** @type {Promise<number>|undefined} */
    let runPromise;
    /** @type {((value: number) => void)|undefined} */
    let resolveRun;

    /**
     * Emit a lightweight bootstrap trace to the console.
     *
     * @param {string} message
     * @param {object} [data]
     */
    const trace = (message, data) => {
      if (data === undefined) {
        console.info(`[bootstrap] ${message}`);
        return;
      }
      console.info(`[bootstrap] ${message}`, data);
    };

    const completeRun = (code = 0) => {
      if (resolveRun) {
        const nextResolve = resolveRun;
        resolveRun = undefined;
        runPromise = undefined;
        nextResolve(code);
      }
    };

    this.run = async function ({ projectRoot, cliArgs }) {
      void cliArgs;
      if (runPromise) {
        return runPromise;
      }
      runPromise = new Promise(resolve => {
        resolveRun = resolve;
      });
      const webRoot = `${projectRoot}/web`;
      const runtimeParams = await appCfgRuntimeLoader.load({ projectRoot });

      trace("run:start", { projectRoot, webRoot });
      trace("runtime:configured", runtimeParams);

      appEventAttributeProviderHolder.set(appEventAttributeProvider);
      trace("event-attribute-provider:registered", {
        provider: appEventAttributeProvider.constructor?.name ?? "anonymous",
      });

      await appWebStaticHandler.init({
        sources: [
          appWebSourceFactory.create({
            root: webRoot,
            prefix: "/",
            allow: {
              ".": ["."],
            },
            defaults: ["index.html"],
          }),
        ],
      });
      trace("static:initialized", { root: webRoot, prefix: "/" });

      appWebPipelineEngine.addHandler(appWebStaticHandler);
      trace("pipeline:handler-registered", { handler: appWebStaticHandler.constructor?.name });

      trace("server:start");
      await appWebServer.start();
      started = true;
      trace("server:started");

      return runPromise;
    };

    this.stop = async function () {
      trace("stop:requested", { started });
      if (!started) {
        trace("stop:skipped");
        completeRun(0);
        return;
      }

      trace("server:stopping");
      await appWebServer.stop();
      started = false;
      trace("server:stopped");
      completeRun(0);
    };
  }
}

export const __deps__ = Object.freeze({
  appCfgRuntimeLoader: "Github_Flows_App_Config_Loader$",
  appEventAttributeProviderHolder: "Github_Flows_Event_Attribute_Provider_Holder$",
  appEventAttributeProvider: "Github_Flows_App_Event_Attribute_Provider$",
  appWebPipelineEngine: "Fl32_Web_Back_PipelineEngine$",
  appWebStaticHandler: "Fl32_Web_Back_Handler_Static$",
  appWebSourceFactory: "Fl32_Web_Back_Dto_Source__Factory$",
  appWebServer: "Github_Flows_Web_Server$",
});
