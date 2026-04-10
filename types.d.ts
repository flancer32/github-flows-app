declare global {
  type Github_Flows_App_Config_Loader = import("./src/Config/Loader.mjs").default;
  type Github_Flows_App_Bootstrap = import("./src/Bootstrap.mjs").default;
  type Github_Flows_App_Config_Runtime = import("./src/Config/Runtime.mjs").Data;
  type Github_Flows_App_Config_Runtime__Factory = import("./src/Config/Runtime.mjs").Factory;
  type Github_Flows_App_Config_Runtime__Wrapper = import("./src/Config/Runtime.mjs").default;
  type Node_Fs = typeof import("node:fs");
  type Node_Path = typeof import("node:path");
}

export {};
