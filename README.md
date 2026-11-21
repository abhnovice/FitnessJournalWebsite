# Abhyudaya’s Best Life

Workout journal and daily nutrition diary for the existing private Site.

## Run locally

Requires Node.js and Python 3 (standard library only).

```sh
npm run build
npm test
npm run dev
```

Open http://127.0.0.1:4173. The local preview uses an isolated SQLite database in `.preview/` and a fixed local development identity. It binds only to loopback. Hosted authentication and hosted data are not used in this preview. Set provider keys in the process environment if you want to exercise live search locally; the dev script does not load `.env` files. Manual logging works without provider keys.

## Changes

- Nutrition tab follows the existing system, slate, forest and ember themes.
- Food names use the original character TF-IDF workbook lookup first. Food photos run the converted MobileNet/SVM locally in a browser worker. Accepted results require strictly above 60%; Gemini provides labeled fallback suggestions. Confirmation uses an exact workbook record before requesting a Gemini estimate.
- Numeric barcodes call Barcode Lookup for identification and Open Food Facts for package nutrition. Provider failures are explicit; a missing nutrient is never silently recorded as zero. Incomplete package data offers manual entry.
- Confirm per-100 g or per-100 ml values, enter the amount actually consumed, and select Breakfast/Lunch/Dinner/Snack. Daily calorie/protein/carbohydrate/fat totals use `nutrient_per_100 × amount / 100`.
- Daily logs persist by authenticated account and selected India-calendar date, in their own D1 table. Removal is scoped to the account and day. Repeating an uncertain save with the same entry ID cannot duplicate it.
- The restarted plan begins **30 November 2026**. Launchpad is Week 1 (30 November–6 December), Cardio Staircase is Week 2 (7–13 December), and Jog + Circuit covers Weeks 3–5 (14 December–3 January). Circuit volumes are 1 circuit for 1 weekday, 2 for 2 weekdays, 3 for 3 weekdays, 4 for 4 weekdays and 5 for 5 weekdays, with a 5 km jog every weekday and 5 km weekend walks. Study Gladiator Body Workout is added on 2–3 January. Block 1 starts **4 January 2027**. Remaining block durations are retained, ending **14 January 2028**.

Photo inference needs no external Python service: the frozen encoder runs with ONNX Runtime Web 1.23.2, and the exported SVM/calibration/novelty checks run in JavaScript. Names retain the upstream TF-IDF similarity measure, which is not a calibrated probability. The ingredient-recipe editor remains outside this integration.

## Sources and build

- `src/page.html`: outer navigation, appearance settings, account progress bridge.
- `src/journal.html`: existing journal iframe document and programme.
- `src/nutrition.html` and `src/nutrition-ui.js`: nutrition UI and browser interactions.
- `src/nutrition.mjs`: server-only provider adapters, validation and diary routes.
- `src/worker.mjs`: existing Worker routes and embedded artwork, with nutrition routing.
- `scripts/build.mjs`: deterministic, dependency-free generation of `dist/index.html` and the self-contained `dist/server/index.js`.
- `drizzle/0002_nutrition_entries.sql`: additive nutrition migration. Existing workout storage and records are unchanged.

`dist/`, local data, node_modules and real environment files are ignored. The build embeds the original artwork, so no additional image downloads are required. The older `DEVELOPER_GUIDE.md` documents the original application; this README supersedes its statements about missing build scripts and programme dates.

## Hosted deployment

Preserve `.openai/hosting.json`, including the existing project ID and DB binding. Set `GEMINI_API_KEY` and `BARCODE_API` as secret production runtime values. Optional `GEMINI_MODEL` selects an enabled model; otherwise available models are discovered. Never put credentials in source, build output or browser storage.

Publish the built source through the existing Site’s source repository and version/deployment workflow. The platform applies the appended Drizzle migration before the Worker upload. Preserve the Site’s private audience. Merging a GitHub PR alone does not publish this Site.

## Verification

`npm test` uses SQLite to check persistence, idempotency, date boundaries and account isolation. Provider tests use synthetic mocked responses for failure handling and estimate labeling. Those tests do not verify live API credentials, live provider availability, hosted D1 migration or browser rendering.

## Camera and frequently used foods

The search field camera button opens a scanner panel. Scan barcode uses the rear camera when available; camera access begins only after that action. Closing the panel, stopping the scanner, switching away from Nutrition or hiding the page releases camera tracks. Choose picture accepts a barcode or food image; Take food photo requests the mobile camera through the browser file picker. Both keep barcode decoding on the device with the bundled ZXing Browser 0.1.5 decoder. A barcode is passed through the existing package lookup. Unrecognized pictures offer an explicit Identify food action, which sends a resized JPEG to Gemini; suggestions still require food confirmation. Images are never stored in the diary or database. Recognition depends on camera quality and provider availability.

Frequently used foods are rebuilt from the signed-in account's latest 1,000 diary entries, ranked by usage, with up to 20 cached profiles returned and eight matching foods shown. No third-party lookup is needed to reuse them. The latest logged nutrition, unit, meal and portion for each normalized name/unit pair are restored for review. Food names filter this list as you type. Data remains in the account-scoped diary rather than shared browser storage; it persists across devices and reloads. Removing all diary entries for a food removes its source history on the next refresh. No offline meal-save queue is introduced.

Additional verification covers saved-food frequency/ranking, latest portions, account isolation, reloaded history, malformed/oversized photos, food confirmation after image suggestions, and the locally served decoder. A generated EAN-13 fixture exercises the real browser image-decoding path. Physical mobile camera capture needs on-device validation and camera permission.

## Fresh plan revision

`src/training-plan.mjs` supplies the tested calendar and a plan revision to the journal and Worker build. The November restart clears the signed-in account's previous checkmarks, rewards, notes, weekly metrics, logged measurements, milestone flags and diet-adherence marks when its progress record is next read. The replacement record is written to D1 once; new progress is retained on later reads. Old browser tabs receive HTTP 409 instead of overwriting the new plan. Previous local progress is removed and automatic legacy import is disabled. Progress backups from another plan revision are rejected. Food diary history, frequently used foods and uploaded medical files remain separate from workout-plan progress. Consistency maps begin on the new plan's start date.

Calendar and restart tests verify all fourteen initial days, circuit counts and weekday spacing, study days, Block 1's Monday start, subsequent block continuity, persistent clearing of old records and rejection of stale saves.

## Plan browsing and typography

Plan displays every phase, including all Gladiator and BYOW blocks. Phase and week previews remain inspectable with disabled task and note controls until all prerequisite work is complete. The same phase gates are used by Home and Workouts. Entering Plan resets the accordion to the available calendar week, or the first unfinished week if the scheduled week is locked, then highlights and scrolls to it. Manually opening a phase or week closes its peers. A frame-ready handshake preserves direct navigation into Plan.

Page headers use embedded Microsoft Fluent System Icons matched to the active route. Roboto and Roboto Mono are loaded from Google Fonts for the shell, nutrition controls and journal iframe. These presentation updates retain the existing plan revision and do not reset saved progress or change runtime provider configuration.

## Browser model conversion

- Source: abhnovice/Nutrition-Module commit 7742b5454b9e62bb1c536469e6806c3fc23b0296. The converter checks SHA-256 for both supplied model files.
- Run scripts/convert-browser-model.py with --assets (directory containing model.npz and mobilenetv2-12.onnx), --workbook, --output (asset directory outside the source tree), --source (this repository), and --runtime (onnxruntime-web-1.23.2.tgz from npm pack). Build dependencies are in scripts/model-conversion-requirements.txt.
- The converter reconstructs the original SVM once, exports exact numeric parameters and training-reference vectors, and exposes MobileNet's pooled features. No model fitting runs in the browser.
- Run node scripts/check-browser-model.mjs /absolute/asset/directory to check the JavaScript classifier, Pillow-compatible bilinear resizing, and WebAssembly encoder against Python. Results are in tests/fixtures/browser-model-validation.json.
- Immutable inference files live in the existing BUCKET binding. After deployment, PUT each file to /ml-assets/nutrition-ml-v1/<filename> using Sites owner-private service access. Only files listed in src/ml-manifest.json with the exact byte length and SHA-256 are accepted. No environment variables are added.
- The first photo use downloads approximately 97 MB. Model parameters use versioned CacheStorage with SHA-256 verification; ONNX Runtime uses same-origin browser HTTP caching. Storage eviction may require downloading again. No food photo is stored in the model cache. The worker is released when leaving Nutrition.
- The image confidence is calibrated top-1 correctness, rather than a per-label probability. Crop agreement and the original nearest-neighbor novelty threshold remain required in addition to confidence >0.60. Text scores remain explicitly labeled name similarity.
