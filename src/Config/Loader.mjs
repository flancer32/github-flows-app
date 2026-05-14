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
   * @param {Github_Flows_App_Config_Runtime__Factory} deps.appCfgRuntimeFactory
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
     * Require a non-empty configuration string.
     *
     * @param {string} name
     * @param {unknown} value
     * @returns {string}
     */
    const requireNonEmptyString = (name, value) => {
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Invalid runtime configuration field ${name}: value must be a non-empty string.`);
      }
      return value;
    };

    /**
     * Parse and validate an HTTP port value.
     *
     * @param {string} value
     * @returns {number}
     */
    const parsePort = value => {
      const result = Number.parseInt(value, 10);
      if (!Number.isInteger(result) || String(result) !== value || result < 1 || result > 65_535) {
        throw new Error("Invalid runtime configuration field PORT: value must be an integer from 1 to 65535.");
      }
      return result;
    };

    /**
     * Normalize environment values into runtime configuration.
     *
     * @param {Record<string, string>} env
     * @param {string} projectRoot
     * @returns {{
     *   httpHost: string,
     *   httpPort: number,
     *   workspaceRoot: string,
     *   webhookSecret: string,
     * }}
     */
    const buildRuntimeConfig = (env, projectRoot) => {
      const cfg = {
        httpHost: "127.0.0.1",
        httpPort: 3000,
        workspaceRoot: `${projectRoot}/var/work`,
        webhookSecret: "replace-with-shared-secret",
      };
      if (env.HOST !== undefined) cfg.httpHost = requireNonEmptyString("HOST", env.HOST);
      if (env.PORT !== undefined) cfg.httpPort = parsePort(env.PORT);
      if (env.WORKSPACE_ROOT !== undefined) {
        cfg.workspaceRoot = requireNonEmptyString("WORKSPACE_ROOT", env.WORKSPACE_ROOT);
      }
      if (env.WEBHOOK_SECRET !== undefined) {
        cfg.webhookSecret = requireNonEmptyString("WEBHOOK_SECRET", env.WEBHOOK_SECRET);
      }
      return cfg;
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
     * @returns {Promise<Github_Flows_App_Config_Runtime>}
     */
    this.load = async function ({ projectRoot }) {
      const env = await readEnvFile(projectRoot);
      const cfg = buildRuntimeConfig(env, projectRoot);
      appCfgRuntimeFactory.configure(cfg);
      return appCfgRuntimeFactory.freeze();
    };
  }
}

export const __deps__ = Object.freeze({
  default: {
    fs: "node:fs",
    path: "node:path",
    appCfgRuntimeFactory: "Github_Flows_App_Config_Runtime__Factory$",
  },
});
