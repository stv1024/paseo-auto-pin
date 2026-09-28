// Renders promo.html frame-by-frame into an MP4.
// Usage: node promo/render.mjs [--fps 60] [--stills 1,4,8] [--out promo/auto-pin-promo.mp4]
// Needs playwright-core and ffmpeg-static (resolved from NODE_PATH or local node_modules) and a local Chrome.
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(path.join(process.env.PROMO_TOOLS ?? process.cwd(), "noop.js"));
const { chromium } = require("playwright-core");
const ffmpeg = require("ffmpeg-static");

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) =>
  a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc, []));
const here = path.dirname(fileURLToPath(import.meta.url));
const fps = Number(args.fps ?? 60);
const out = path.resolve(args.out ?? path.join(here, "auto-pin-promo.mp4"));

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, "promo.html")).href);
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.T_END);

if (args.stills) {
  for (const t of args.stills.split(",").map(Number)) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: path.join(here, `still-${t}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const audio = path.join(here, "soundtrack.wav");
execFileSync(process.execPath, [path.join(here, "audio.mjs"), audio], { stdio: "inherit" });
const enc = spawn(ffmpeg, [
  "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
  "-i", audio, "-c:a", "aac", "-b:a", "192k", "-shortest",
  "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
], { stdio: ["pipe", "inherit", "inherit"] });

const frames = Math.round(duration * fps);
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.render(t), i / fps);
  const buf = await page.screenshot({ type: "png" });
  if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once("drain", r));
  if (i % fps === 0) process.stdout.write(`\r${i}/${frames}`);
}
enc.stdin.end();
await new Promise((r) => enc.on("close", r));
await browser.close();
console.log(`\nwrote ${out}`);
