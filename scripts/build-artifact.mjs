// Builds dist/rulebook.html for publishing as a claude.ai artifact. The artifact host wraps the page
// in its own <html>/<head>/<body> skeleton, so this keeps only the title, metas, stylesheet link and
// body contents of index.html. src/ and data/ are published alongside it as separate files.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("..", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");

const pick = (re) => html.match(re)?.[0] ?? "";
const head = [
  pick(/<title>[\s\S]*?<\/title>/),
  '<meta name="claude:viewport-fit-sides" content="cover">',
  pick(/<meta name="description"[^>]*>/),
  pick(/<link rel="stylesheet"[^>]*>/),
].join("\n");
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].trim();

mkdirSync(new URL("dist/", root), { recursive: true });
writeFileSync(new URL("dist/rulebook.html", root), `${head}\n\n${body}\n`);
console.log("Wrote dist/rulebook.html");
