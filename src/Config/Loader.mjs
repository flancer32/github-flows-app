// @ts-check

/**
 * @namespace Github_Flows_App_Config_Loader
 * @description Runtime configuration loader for github-flows-app.
 */
export default class Github_Flows_App_Config_Loader {
  /**
   * @param {object} deps
   * @param {typeof import("node:fs")} deps.fs
   * @param {typeof import("node:path")} deps.path
   * @param {Github_Flows_Config_Runtime__Factory} deps.appCfgRuntimeFactory
   */
  constructor({ fs, path, appCfgRuntimeFactory }) {
    /**
     * Parse dotenv-style content into a plain object.
     *
     * @param {string} content
     * @returns {Record<string, string>}
     */
    const parseEnv = content => {
      /** @type {Record<string, string>} */
      const result = {};
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith("#")) {
          continue;
        }
        const idx = trimmed.indexOf("=");
        if (idx <= 0) {
          continue;
        }
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        result[key] = value;
      }
      return result;
    };

    /**
     * Read dotenv file from the project root.
     *
     * @param {string} projectRoot
     * @returns {Promise<Record<string, string>>}
     */
    const readEnvFile = async projectRoot => {
      const filePath = path.join(projectRoot, ".env");
      try {
        const content = await fs.promises.readFile(filePath, "utf8");
        return parseEnv(content);
      } catch (error) {
        if (error && error.code === "ENOENT") {
          return {};
        }
        throw error;
      }
    };

    /**
     * Load runtime parameters from env file.
     *
     * @param {object} params
     * @param {string} params.projectRoot
     * @returns {Promise<object>}
     */
    this.load = async function ({ projectRoot }) {
      const env = await readEnvFile(projectRoot);
      const cfg = {
        httpHost: "127.0.0.1",
        httpPort: 3000,
        workspaceRoot: `${projectRoot}/var/work`,
        runtimeImage: "codex-agent",
        webhookSecret: "replace-with-shared-secret",
      };
      if (env.HOST !== undefined) cfg.httpHost = env.HOST;
      if (env.PORT !== undefined) cfg.httpPort = Number.parseInt(env.PORT, 10);
      if (env.WORKSPACE_ROOT !== undefined) cfg.workspaceRoot = env.WORKSPACE_ROOT;
      if (env.RUNTIME_IMAGE !== undefined) cfg.runtimeImage = env.RUNTIME_IMAGE;
      if (env.WEBHOOK_SECRET !== undefined) cfg.webhookSecret = env.WEBHOOK_SECRET;
      appCfgRuntimeFactory.configure(cfg);
      appCfgRuntimeFactory.freeze();
      return cfg;
    };
  }
}

export const __deps__ = Object.freeze({
  default: {
    fs: "node:fs",
    path: "node:path",
    appCfgRuntimeFactory: "Github_Flows_Config_Runtime__Factory$",
  },
});
