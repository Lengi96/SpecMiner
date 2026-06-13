import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number.parseInt(process.env.PORT ?? "4177", 10);
const root = dirname(fileURLToPath(import.meta.url));

const server = createServer(async (request, response) => {
  const path = request.url === "/" ? "index.html" : request.url?.replace(/^\//, "") ?? "index.html";
  try {
    const body = await readFile(join(root, path));
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Demo site listening on http://127.0.0.1:${port}`);
});
