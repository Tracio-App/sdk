// Minimal same-origin static server for the Playwright CDN/dist smoke.
// Serves the @tracio/sdk package directory so the built artifacts
// (/dist/index.min.js, /dist/index.js) and the fixtures (/e2e/fixtures/*)
// are reachable over http:// — file:// breaks module scripts + script
// injection, so a real origin is required.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const ROOT = process.cwd(); // the sdk package dir (Playwright runs from there)
const PORT = Number(process.env.PORT || 5273);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = normalize(urlPath).replace(/^([.][.][/\\])+/, "");
    const file = join(ROOT, rel);
    if (file !== ROOT && !file.startsWith(ROOT + sep)) {
      res.writeHead(403, { "Content-Type": "text/plain" }).end("forbidden");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
  }
});

server.listen(PORT, () => console.log(`e2e static server on http://localhost:${PORT}`));
