// Appends clues from a JSON array file to data/clues.json. Usage: node scripts/merge-clues.mjs <file.json>
import { readFileSync, writeFileSync } from "node:fs";
const path = new URL("../data/clues.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const incoming = JSON.parse(readFileSync(process.argv[2], "utf8"));
data.clues.push(...incoming);
writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`Added ${incoming.length} clues (${data.clues.length} total)`);
