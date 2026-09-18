import { spawn } from "node:child_process";
import path from "node:path";

const webExtEntryPoint = path.join("node_modules", "web-ext", "bin", "web-ext.js");
const child = spawn(process.execPath, [webExtEntryPoint, ...process.argv.slice(2)], {
  env: {
    ...process.env,
    NO_UPDATE_NOTIFIER: "1",
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`web-ext exited after signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
