import { defineConfig } from "wxt";

export default defineConfig({
  manifest: ({ manifestVersion }) => ({
    name: "Marvin Enhancement Suite",
    short_name: "MES",
    description: "Unofficial fixes and opt-in power tools for Amazing Marvin.",
    permissions: ["storage"],
    host_permissions: ["https://app.amazingmarvin.com/*"],
    optional_host_permissions: manifestVersion === 3 ? ["https://serv.amazingmarvin.com/*"] : undefined,
    optional_permissions: manifestVersion === 2 ? ["https://serv.amazingmarvin.com/*"] : undefined,
    web_accessible_resources: [
      {
        resources: [
          "autocomplete-main.js",
          "explicit-duration-main.js",
          "procrastination-main.js",
          "subtask-toggle-main.js",
        ],
        matches: ["https://app.amazingmarvin.com/*"],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: "marvin-enhancement-suite@rajpiskala",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  }),
});
