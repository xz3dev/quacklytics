# Landing page media

The landing page (`apps/home/src/pages/index.astro`) uses real screenshots of the app and an overview video rendered from HTML. Both can be regenerated when the UI or the story changes. Run the scripts with Node (they use Playwright's browser, which doesn't work under Bun's HTTP client) from the repository root.

## Screenshots

1. Start an instance with development storage (`bun run storage:up`, then `bun run build && bun run start`, or `bun run dev`) and register an administrator.
2. Create the Orbit demo project: `QUACKLYTICS_PASSWORD=… bun run seed:dev --email you@example.com`. Optionally rename it to "Orbit" in the project settings, since the sidebar shows its initial.
3. Capture:

   ```sh
   QUACKLYTICS_EMAIL=you@example.com QUACKLYTICS_PASSWORD=… \
     node scripts/landing/capture-screenshots.ts --url http://127.0.0.1:3000 --project <project-id>
   ```

Images are written to `apps/home/src/assets/screenshots` at 2× scale in dark mode. Astro converts them to responsive WebP at build time.

The first-run screens in "Get started" (registration, new project, setup guide) need an instance without an administrator, such as a fresh `DATA_DIR`. The script registers one through the one-time setup link the server logs on startup:

```sh
node scripts/landing/capture-setup.ts --setup-link "http://127.0.0.1:3000/register?token=…"
```

## Overview video

`intro.html` is the storyboard: open it in a browser to preview it in real time. Scene windows live in the `S` object in its script, followed by one block per scene. The sign-up numbers in its agent answer are real values from the Orbit demo data, as are the landing page's agent examples (`apps/home/src/pages/index.astro`). To render `apps/home/public/video/quacklytics-overview.mp4` (1080p, 60 fps) and its poster `.jpg` (requires `ffmpeg` and network access for the Geist font):

```sh
node scripts/landing/render-intro.ts
```

`--preview 3,12.5,40` writes still frames at those seconds instead, which is quicker for checking a layout. `--poster <seconds>` picks the poster frame.
