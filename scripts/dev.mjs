// Starts `next dev` with a larger HTTP header limit. Browsers send every
// localhost cookie (from all local apps) to this server; past Node's default
// 16 KB the request fails with "HTTP ERROR 431". Next passes NODE_OPTIONS on to
// its dev server process.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const options = [process.env.NODE_OPTIONS, "--max-http-header-size=65536"].filter(Boolean).join(" ");

const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: options },
});
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
