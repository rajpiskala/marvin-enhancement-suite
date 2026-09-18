import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(projectRoot, ".output/chrome-mv3");
const port = Number(process.env.MES_PREVIEW_PORT || 4173);
const defaultSettings = {
  masterEnabled: true,
  features: {
    autocompleteCleanup: true,
    procrastinationDate: true,
    explicitDurations: false,
    subtaskToggle: false,
    taskUnroller: false,
  },
  unrollerApiToken: "",
  unrollerFullAccessToken: "",
};
const browserMock = `<script>
globalThis.chrome = {
  storage: {
    local: {
      get: async () => ({ "mes.settings.v1": ${JSON.stringify(defaultSettings)} }),
      set: async () => undefined
    },
    onChanged: { addListener() {}, removeListener() {} }
  },
  permissions: { request: async () => true, remove: async () => true },
  tabs: { query: async () => [], reload: async () => undefined, sendMessage: async () => ({ ok: true, createdTaskCount: 0 }) },
  runtime: { id: "mes-preview", onMessage: { addListener() {}, removeListener() {} }, sendMessage: async () => undefined }
};
</script>`;

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    if (url.pathname === "/store-screenshot.html") {
      const html = await readFile(path.join(projectRoot, "assets/store-screenshot.html"));
      response.writeHead(200, { "content-type": mimeTypes[".html"] });
      response.end(html);
      return;
    }

    const relativePath = url.pathname === "/" ? "popup.html" : url.pathname.slice(1);
    const absolutePath = path.resolve(buildRoot, relativePath);
    if (!absolutePath.startsWith(`${buildRoot}${path.sep}`) && absolutePath !== path.join(buildRoot, "popup.html")) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    let contents = await readFile(absolutePath);
    if (relativePath === "popup.html") {
      let html = contents.toString("utf8").replace("<script type=\"module\"", `${browserMock}<script type=\"module\"`);
      if (url.searchParams.has("screenshot")) {
        html = html.replace("</head>", "<style>html,body{max-height:none!important}</style></head>");
      }
      contents = Buffer.from(html);
    }

    response.writeHead(200, { "content-type": mimeTypes[path.extname(absolutePath)] || "application/octet-stream" });
    response.end(contents);
  } catch (error) {
    const status = error && typeof error === "object" && "code" in error && error.code === "ENOENT" ? 404 : 500;
    response.writeHead(status).end(String(error));
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`MES preview: http://127.0.0.1:${port}/popup.html?screenshot=1`);
});
