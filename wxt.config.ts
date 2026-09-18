import { defineConfig } from "wxt";

const icons = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export default defineConfig({
  manifest: ({ browser, manifestVersion }) => ({
    name: "Marvin Enhancement Suite",
    short_name: "MES",
    description: "Unofficial fixes and opt-in power tools for Amazing Marvin.",
    homepage_url: "https://github.com/rajpiskala/marvin-enhancement-suite",
    icons,
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
    browser_specific_settings: browser === "firefox"
      ? {
        gecko: {
          id: "marvin-enhancement-suite@rajpiskala",
          strict_min_version: "140.0",
          data_collection_permissions: {
            required: ["none"],
            optional: ["authenticationInfo", "websiteContent"],
          },
        },
        gecko_android: {
          strict_min_version: "142.0",
        },
      }
      : undefined,
    ...(manifestVersion === 2
      ? {
        browser_action: {
          default_title: "Open Marvin Enhancement Suite",
          default_icon: icons,
        },
      }
      : {
        action: {
          default_title: "Open Marvin Enhancement Suite",
          default_icon: icons,
        },
      }),
  }),
  zip: {
    includeSources: [
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "assets/**/*",
      "LICENSE",
      "PRIVACY.md",
      "README.md",
      "SECURITY.md",
      "amo-metadata.json",
      "docs/**/*",
      "entrypoints/**/*",
      "package-lock.json",
      "package.json",
      "public/icons/**/*",
      "src/**/*",
      "store-assets/**/*",
      "tools/generate-icons.mjs",
      "tools/run-web-ext.mjs",
      "tools/set-version.mjs",
      "tools/submit-stores.mjs",
      "tools/verify-release.mjs",
      "tsconfig.json",
      "wxt.config.ts",
    ],
  },
});
