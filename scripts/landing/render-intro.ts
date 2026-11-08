// Renders scripts/landing/intro.html frame by frame into the landing page's
// overview video and poster. Requires ffmpeg. See scripts/landing/README.md.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { z } from "zod";

const { values } = parseArgs({
  options: {
    fps: { type: "string", default: "60" },
    out: {
      type: "string",
      default: "apps/home/public/video/quacklytics-overview",
    },
    poster: { type: "string", default: "7.5" },
    preview: { type: "string" },
  },
  strict: true,
});
const fps = z.coerce.number().int().min(1).max(60).parse(values.fps);
const posterAt = z.coerce.number().min(0).parse(values.poster);
const out = resolve(values.out);
await mkdir(resolve(out, ".."), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const source = pathToFileURL(resolve("scripts/landing/intro.html"));
source.search = "render";
await page.goto(source.href, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((image) => image.decode()));
});
const duration = z
  .number()
  .positive()
  .parse(await page.evaluate(() => Reflect.get(window, "DURATION")));
const seek = (seconds: number) =>
  page.evaluate((t) => {
    const seekTo: unknown = Reflect.get(window, "seek");
    if (typeof seekTo === "function") seekTo(t);
  }, seconds);

// --preview 12,30.5 writes stills for quick checks instead of the video.
if (values.preview) {
  for (const seconds of values.preview.split(",").map(Number)) {
    await seek(seconds);
    await page.screenshot({ path: `${out}-preview-${seconds}.png` });
  }
  await browser.close();
  process.exit(0);
}

await seek(posterAt);
await page.screenshot({ path: `${out}.jpg`, type: "jpeg", quality: 85 });

const encode = `-y -loglevel error -f image2pipe -c:v mjpeg -framerate ${fps} -i -
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart`;
const ffmpeg = spawn("ffmpeg", [...encode.split(/\s+/), `${out}.mp4`], {
  stdio: ["pipe", "inherit", "inherit"],
});
const frames = Math.round(duration * fps);
for (let frame = 0; frame < frames; frame++) {
  await seek(frame / fps);
  const image = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ffmpeg.stdin.write(image)) await once(ffmpeg.stdin, "drain");
  if (frame % (fps * 5) === 0)
    console.log(`${(frame / fps).toFixed(0)}s / ${duration}s`);
}
ffmpeg.stdin.end();
const [code] = await once(ffmpeg, "close");
await browser.close();
if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
console.log(`Wrote ${out}.mp4 and ${out}.jpg`);
