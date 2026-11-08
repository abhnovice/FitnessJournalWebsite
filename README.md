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
- Food-name search adapts the Gemini suggestion → explicit food confirmation → generic nutrition estimate flow from `abhnovice/Nutrition-Module/external_services.py`.
- Numeric barcodes call Barcode Lookup for identification and Open Food Facts for package nutrition. Provider failures are explicit; a missing nutrient is never silently recorded as zero. Incomplete package data offers manual entry.
- Confirm per-100 g or per-100 ml values, enter the amount actually consumed, and select Breakfast/Lunch/Dinner/Snack. Daily calorie/protein/carbohydrate/fat totals use `nutrient_per_100 × amount / 100`.
- Daily logs persist by authenticated account and selected India-calendar date, in their own D1 table. Removal is scoped to the account and day. Repeating an uncertain save with the same entry ID cannot duplicate it.
- The two-day Launchpad begins **9 November 2026**. Cardio begins **11 November 2026**. Phase durations and saved activity IDs are retained; the old October recovery pause predates the new start; actual weekdays govern weekend walks. The full shifted plan ends **20 February 2028**. September body measurements remain historical September measurements.

The Python prototype’s local ONNX/SVM image classifier, workbook lookup and ingredient-recipe editor are not part of this search/barcode integration. Food-name estimates are always labeled as estimates; they are not presented as workbook nutrition or verified package data. The Sites Worker runtime does not run the Python model.

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
