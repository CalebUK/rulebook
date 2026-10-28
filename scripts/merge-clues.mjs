// Appends clues from a JSON array file to data/clues.json. Usage: node scripts/merge-clues.mjs <file.json>
import { readFileSync, writeFileSync } from "node:fs";
const path = new URL("../data/clues.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const incoming = JSON.parse(readFileSync(process.argv[2], "utf8"));
// New clues get the next free id for their sport and level, e.g. soccer-2c.
const taken = new Set(data.clues.map((c) => c.id));
for (const c of incoming) {
  if (c.id) continue;
  let letter = 97;
  while (taken.has(`${c.sport}-${c.level}${String.fromCharCode(letter)}`)) letter++;
  c.id = `${c.sport}-${c.level}${String.fromCharCode(letter)}`;
  taken.add(c.id);
}
data.clues.push(...incoming.map(({ id, ...rest }) => ({ id, ...rest })));
writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`Added ${incoming.length} clues (${data.clues.length} total)`);
