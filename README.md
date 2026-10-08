# Royal Solitaire

Klondike for [akshat96af.github.io/Solitair](https://akshat96af.github.io/Solitair/).

## Develop and check

Use Node.js 24, then run `npm ci`, `npm test`, and `npm run build`.
`npm run dev` starts development; `npm run preview` serves the production build at `/Solitair/`.

## GitHub Pages

In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions**.
Push to `main` (or run the Pages workflow manually from `main`) to validate, build and deploy.
Pull requests run tests and build without deploying. Vite uses the fixed `/Solitair/` base for assets and the game-analysis worker.
The workflow follows the [official Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages).

Keep `package-lock.json` committed for reproducible installs. `node_modules` and `dist` are generated and ignored;
neither belongs in the source repository. Actions recreates them and publishes only the contents of `dist`.

## Motion and performance

Card movement uses compositor transforms. Drag smoothing is based on elapsed time, so it behaves consistently on
60/120/144 Hz displays. Effects have a fixed particle budget; expensive stuck-game searches run in a worker.
Reduced-motion preferences disable decorative effects and skip the deal sequence.

120 fps requires a compatible display, browser and GPU; it is a target, not a guaranteed frame rate.
For a real-device check, record dragging, rapid draws and auto-finish in browser DevTools Performance with a 120 Hz display
(8.33 ms frame budget). Also check touch dragging, pointer cancellation, pause/resume, resize and reduced motion.
