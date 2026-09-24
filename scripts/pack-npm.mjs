import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(root, "paseo-plugin.json"), "utf8"));
// Only this Git dependency-install step may be omitted. Future preparation
// commands need an explicit publishing decision rather than silently disappearing.
assert.deepEqual(manifest.build, [["npm", "ci", "--include=dev", "--ignore-scripts"]]);
delete manifest.build;
delete pkg.private;
delete pkg.scripts;

const output = await mkdtemp(join(tmpdir(), "paseo-auto-pin-npm-"));
const staging = join(output, "package");
await mkdir(staging);
for (const file of [...pkg.files, "README.md", "LICENSE"]) {
  await cp(join(root, file), join(staging, file), { recursive: true });
}
await writeFile(join(staging, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
await writeFile(join(staging, "paseo-plugin.json"), JSON.stringify(manifest, null, 2) + "\n");

const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run this script with npm run pack:npm");
const { stdout } = await promisify(execFile)(process.execPath, [
  npmCli, "pack", "--ignore-scripts", "--json", "--pack-destination", output,
], { cwd: staging });
const [packed] = JSON.parse(stdout);
console.log(JSON.stringify({
  artifact: join(output, packed.filename),
  staging,
  version: packed.version,
  integrity: packed.integrity,
  files: packed.files.map((file) => file.path),
}, null, 2));
