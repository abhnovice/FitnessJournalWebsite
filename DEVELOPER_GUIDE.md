# Abhyudaya's Best Life: Beginner Developer Guide

This guide describes the code currently in this repository. It assumes you understand variables, functions, arrays, objects, and `if` statements, but may be new to web development.

## 1. The site in one minute

The site has four layers:

1. **HTML** supplies visible elements such as headings, buttons, and checkboxes.
2. **CSS** controls colour, spacing, layout, hover states, and animation.
3. **JavaScript** creates the programme, responds to taps, calculates progress, changes views, and asks the server to save.
4. **The server and database** return the page and store one progress record for each signed-in user.

Most of the interface is bundled into `dist/index.html`. Inside it, the checklist is a second HTML document stored in an iframe's `data-srcdoc` attribute. An **iframe** is a page displayed inside another page; `srcdoc` means its HTML is written directly into the outer page.

The iframe uses `sandbox="allow-scripts"`. A **sandbox** restricts what the inner page can access. The checklist can run JavaScript, but cannot directly call the outer page's account features. The two pages therefore exchange small messages with `window.postMessage(...)`.

`dist/server/index.js` serves the page, images, Progressive Web App files, and `/api/progress`. A **Progressive Web App (PWA)** is a website that a supported browser can install and open like an app.

## 2. File-by-file overview

### Configuration and database

| File | Plain-language purpose |
|---|---|
| `.gitignore` | Tells Git which local or generated files not to track. |
| `.openai/hosting.json` | Connects the repository to Sites project `appgprj_6aa6e99c758c8191a613f43728e7ca74`, names the database binding `DB`, and declares that no R2 file bucket is used. A **binding** is the name through which server code receives a hosted service. |
| `db/schema.ts` | Describes the `user_progress` table in TypeScript using Drizzle. **Drizzle** is a tool for describing SQL tables in code. The runtime does not import this file; it is the developer-facing schema definition. |
| `drizzle/0000_user_progress.sql` | The SQL migration that creates `user_progress`. A **migration** is a saved database change that can be applied consistently. |
| `drizzle/meta/_journal.json` | Drizzle's migration history. Do not hand-edit it during ordinary interface work. |

The database table has three columns:

```text
user_id     signed-in account identifier and unique row key
record      the complete progress object stored as JSON text
updated_at  time of the latest successful save
```

**JSON** is a text format for objects and arrays.

### Deployed application

| File | Plain-language purpose |
|---|---|
| `dist/index.html` | Main application source. The outer document owns navigation, routes, theme choice, the account-save bridge, PWA registration, and the milestone dialog. The embedded document owns programme data, checkboxes, rewards, notes, measurements, calculations, and most components. |
| `dist/server/index.js` | Deployed server bundle. It contains an embedded copy of `dist/index.html`, validates progress, reads and writes the database, serves routes and images, and returns PWA files. |
| `dist/manifest.webmanifest` | Describes the installable app: name, start URL, colours, display mode, and icons. |
| `dist/sw.js` | Service worker. A **service worker** is a browser background script. It caches app metadata and icons, uses the network first for page navigation, and never caches `/api/` requests. |
| `dist/favicon.svg` | Vector browser-tab icon. Vector artwork remains sharp at different sizes. |
| `dist/face-icon.png` | PNG face icon served at `/face-icon.png`. |
| `dist/stronger-self-icon.webp` | Navigation/brand icon served at `/stronger-self-icon.webp`. |
| `dist/apple-touch-icon.png` | Icon used when saved to an Apple home screen. |
| `dist/pwa-icon-192.png` | 192-pixel install icon. |
| `dist/pwa-icon-512.png` | 512-pixel install and maskable icon. A **maskable** icon may be cropped by the operating system into its preferred shape. |
| `dist/body-stats-character-v1.png` | Runtime copy of the body-stats character. |
| `dist/cheering-character-v1.png` | Runtime copy of the cheering/streak character. |
| `dist/dashboard-dumbbell-v1.png` | Dashboard character for dumbbell workouts. |
| `dist/dashboard-pullup-v1.png` | Dashboard character for pull-up workouts. |
| `dist/dashboard-squat-v1.png` | Dashboard character for squat workouts. |
| `dist/dashboard-treadmill-v1.png` | Dashboard character for running/cardio workouts. |
| `dist/home-fit-icon.png` | Runtime copy of the fit home character. |

There is no `package.json` or declared local build command. The checked-in `dist` files are the source of truth for this deployment, not output that this repository can regenerate through a documented build.

### Source artwork

`assets/` is the source artwork library. Several pictures are embedded as data inside `dist/index.html` or `dist/server/index.js`; replacing a source file alone does not change the deployed page.

| Files | Purpose |
|---|---|
| `assets/body-stats-character-v1.png`, `cheering-character-v1.png`, `dashboard-dumbbell-v1.png`, `dashboard-pullup-v1.png`, `dashboard-squat-v1.png`, `dashboard-treadmill-v1.png`, `home-fit-icon.png`, `stronger-self-icon.webp` | Source copies of the named interface characters/icons. |
| `assets/face-avatar-source.png` | Source face artwork used to create branded characters. |
| `assets/fitness-cover.jpg`, `fitness-cover-v2.jpg`, `fitness-cover-v3.jpg`, `fitness-cover-v3.png` | Earlier hero/cover iterations. |
| `assets/fitness-hill-journey-v1.jpg` | Hill-journey hero artwork. |
| `assets/fitness-progression-sprite.png` | Sheet containing multiple fitness-progression poses. A **sprite sheet** is one image containing several smaller images. |
| `assets/progression-icons/icon-00.png` through `icon-15.png` | Sixteen individual character stages. The current page embeds them rather than loading these paths directly. |
| `assets/fluent-icons/LICENSE` | Licence for the Fluent icon artwork. |
| `assets/fluent-icons/*.svg` | Source SVG icons. The exact files are listed below. The page embeds their markup in its JavaScript `fluentIcons` object. |

The Fluent icon files are:

```text
arrow_download.svg     arrow_right.svg       arrow_upload.svg
bed.svg                calendar.svg          calendar_today.svg
chart_multiple.svg     checkmark_circle.svg  clipboard_checkmark.svg
data_usage.svg         dumbbell.svg          heart_pulse.svg
home.svg               lock_closed.svg       navigation.svg
person_running.svg     person_walking.svg    reward.svg
ruler.svg              save.svg              sleep.svg
target.svg             timer.svg             trophy.svg
```

## 3. How the programme is represented

In the embedded JavaScript, `phases` is an array—an ordered list. Each phase is an object like this:

```js
{
  id: "cardio",
  name: "Cardio staircase",
  start: 0,
  weeks: 3,
  note: "Easy jogging · weekend walks included",
  days: 21,
  items: [/* generated activities */]
}
```

`addPhase(id, name, start, weeks, note, taskFn, days)` generates activities. `taskFn` is a **callback**: a function passed into another function to supply custom behaviour. It receives:

```text
i = day number within the phase, starting at 0
w = week number within the phase, starting at 0
d = weekday number, Monday 0 through Sunday 6
```

Dates use 21 September 2026 as offset zero:

```js
const date = (offset) => new Date(Date.UTC(2026, 8, 21 + offset));
```

September is `8` because JavaScript numbers months 0–11. A start of `-2` means 19 September; `21` means 12 October.

Every activity gets this ID:

```text
phase-id + "-" + day-within-phase + "-" + activity-position-on-that-day
```

For example, `cardio-0-0` is the first activity on Cardio's first day. Saved checkbox progress uses IDs, not visible labels. Changing words keeps saved state connected; changing a phase ID or reordering multiple activities on a day can disconnect it.

Current groups are:

- `launchpad`, `cardio`, and `circuit`: individual `addPhase(...)` calls;
- `gladiator-0`–`gladiator-5`: six named blocks generated from `programNames` and `workoutLabel(...)`;
- `byow-0`–`byow-7`: eight phases generated in a loop.

## 4. Checkbox-to-database data flow

```text
1. You tap an activity checkbox in the embedded checklist.
   |
2. Its "change" event handler runs.
   |  An event handler is a function called after an action.
   |
3. JavaScript updates the in-memory `checked` object.
   |  Checked:   checked[item.id] = true
   |  Unchecked: delete checked[item.id]
   |
4. `persist()` creates one version-2 record containing
   |  checked, rewards, notes, weekly, and measurements.
   |
5. The iframe sends it to the outer page with `postMessage`.
   |  Channel: "training-progress-v1"; type: "save"
   |
6. The outer page validates the basic shape and queues a PUT request
   |  to `/api/progress`. PUT means update this resource.
   |
7. `dist/server/index.js` reads the authenticated user ID supplied by
   |  hosting, validates allowed keys/values, and writes JSON to that
   |  user's `user_progress` row.
   |
8. The server returns success.
   |
9. The outer page sends a "saved" message with the matching revision
   |  number back to the iframe.
   |
10. `render()` rebuilds the controls from the current objects.
```

On reload, the flow reverses:

```text
iframe asks to load
  -> outer page GETs /api/progress
  -> server looks up the signed-in user's row
  -> server returns saved data or an empty version-2 record
  -> outer page posts "loaded" to the iframe
  -> iframe sanitises and assigns checked/rewards/notes/weekly/measurements
  -> render() sets each checkbox from !!checked[item.id]
```

A **revision number** increases with each save so an older response cannot be mistaken for confirmation of a newer edit. A save queue makes writes run in order.

## 5. Storage and multi-device auto-save

### Account-backed record

One database row stores this overall shape:

```js
{
  version: 2,
  checked: { "cardio-0-0": true },
  rewards: {
    claimed: { cardio: true },
    custom: { block0: "New smartwatch" },
    locked: { block0: true }
  },
  notes: { "cardio-0": "<p>Week note</p>" },
  weekly: { "cardio-0": { weight: 92.7, bodyFat: 31 } },
  measurements: [
    { date: "2026-09-28", weight: 92.7, bodyFat: 31, waistBelly: 104 }
  ]
}
```

- `checked` contains only completed activity IDs; absence means incomplete.
- `rewards` contains claimed keys, custom Block 1–6 text, and whether custom text was locked.
- `notes` stores sanitised rich-text HTML by `phaseId-weekNumber`. Uploaded note images become data URLs inside the HTML. A **data URL** stores image bytes as text.
- `weekly` stores weight and body-fat entries inside training weeks.
- `measurements` stores dated Body Stats history.

The server rejects requests over 150,000 characters and validates phase IDs, reward keys, ranges, and counts before saving. Its SQL statement creates the row on first save and updates it later.

### Multi-device behaviour

Hosting adds `oai-authenticated-user-id` to the request. The server uses it as `user_id`; browser code does not choose the account ID.

1. Device A saves to the signed-in account's row.
2. Device B, signed into the same account, GETs `/api/progress`.
3. The server reads the same row.
4. Device B renders the returned record.

API requests use `cache: "no-store"`, and the service worker excludes `/api/`, so cached app files are not confused with account data.

This is a latest-whole-record save, not field-by-field merging. If two devices edit simultaneously before loading each other's change, the later complete record can overwrite the earlier one.

### Device-only data and fallback

The theme is stored in browser `localStorage` under `stronger-self-theme-v1`. **localStorage** is a small store belonging to one browser on one device, so themes do not sync.

If the account has no database row, the page checks once for older progress under `training-checklist-20260921-v1`, validates it, and uploads it. This migrates the earlier browser-only version. If the API is unavailable, the checklist receives an empty record and shows that auto-save is unavailable; backup/restore text is the manual fallback.

## 6. Routes

A **route** is a URL path representing a view. Examples:

```text
home          -> /
foundation    -> /foundation
gladiator-0   -> /general-fitness
gladiator-5   -> /unit
body-stats    -> /body-stats
byow-0        -> /byow-1
```

Navigation calls `showPage(...)`, changes the URL with `history.pushState(...)`, marks the active button, and posts the selected view to the iframe. The server returns the same application HTML for every supported route; JavaScript chooses the visible section.

## 7. How to change X

### Safe editing rule

Most changes start in `dist/index.html`, but production serves the copy embedded at the start of `dist/server/index.js` as `PAGE_HTML`. After editing the HTML, synchronise those copies. There is no checked-in build script.

From the repository root, the current bundle can be synchronised with:

```sh
node -e "const fs=require('fs');const p='dist/server/index.js';const html=fs.readFileSync('dist/index.html','utf8');let s=fs.readFileSync(p,'utf8');const marker=';\\nconst RENDERED_PAGE_HTML = PAGE_HTML;';const end=s.indexOf(marker);if(!s.startsWith('const PAGE_HTML = ')||end<0)throw new Error('PAGE_HTML boundary not found');s='const PAGE_HTML = '+JSON.stringify(html)+s.slice(end);fs.writeFileSync(p,s);"
```

Review the diff. This updates only `PAGE_HTML`, not the server's separately embedded manifest, service worker, or images.

### Theme colours

File: `dist/index.html`

Search for `:root[data-site-theme="forest"]`, `ember`, and `slate`. Outer variables control navigation and the milestone overlay:

```text
--nav-bg       background       --nav-border   borders
--nav-text     primary text     --nav-muted    secondary text
--nav-accent   selection/focus  --nav-active   selected background
--nav-hover    hover background
```

The embedded checklist has separate variables. Search for `--tc-accent:`. Its main tokens are `--tc-canvas`, `--tc-surface`, `--tc-ink`, `--tc-muted`, `--tc-line`, `--tc-accent`, and `--tc-success`. A **design token** is a named reusable visual value.

### Add an activity

File: `dist/index.html`

Search for `function addPhase`, then the relevant `addPhase(...)` call or `workoutLabel(...)` branch. Safest is to append a label without changing the phase ID or reordering existing labels:

```js
const tasks = [existingLabel];
if (w === 0 && d === 0) tasks.push('Mobility check-in');
return tasks;
```

Appending gives the new task the next position while retaining old IDs. A completely new phase also requires updates to client/server validation, routes, navigation, and possibly rewards; it is not a one-line content edit.

### Edit a phase

File: `dist/index.html`

Search for its name or `programNames`. In `addPhase(...)` the arguments are:

```text
1 stable ID (do not change after progress exists)
2 visible name
3 start offset from 21 September 2026
4 week count
5 explanatory note
6 activity-generating callback
7 optional exact day count
```

Names and notes are low risk. IDs, dates, weeks, or task order affect stored IDs and require migration planning.

### Edit a reward

File: `dist/index.html`

Search for `Launchpad rewards`, `Cardio staircase reward`, `Jog + circuit reward`, or `Week 10 reward`. `rewardBox(...)` receives a stable key, label, eligibility rule, and hint.

Also update `function milestoneReward` because it separately supplies popup reward text. Keep stable keys such as `cardio`, `circuit`, `week10`, and `block0`; validation and saved claims use them.

### Change unlock rules

File: `dist/index.html`

Search for:

```js
function unlocked(index) {
  return index < 3 || phases.slice(0, index).every(complete);
}
```

Indexes 0–2 are available. Every later phase requires every earlier phase to be complete. `complete(p)` means its checked count equals its activity count. The page reuses `unlocked(...)` for journey state, controls, locked copy, rendering, and later BYOW visibility, so change this central function.

`throughWeek10()` is separate: it controls the smartwatch reward, not phase navigation.

### Change stored data

Files: `dist/index.html`, `dist/server/index.js`, `db/schema.ts`, and possibly a new migration.

Adding a saved field requires updating the blank record, upgrade/sanitising code, `persist()`, client validation, server `emptyRecord()` and `validRecord()`, and load/render code. Change the database schema only for a new column rather than a property inside `record`. Increase the record version and add an upgrade path if the shape becomes incompatible.

## 8. Five hands-on exercises

For each exercise, edit `dist/index.html`, synchronise `PAGE_HTML`, and test the affected view.

### 1 — Change secondary text

- File: `dist/index.html`
- Task: Change Cardio's note to `Easy jogging · relaxed weekend walks`.
- Expected: the new line appears below Cardio; checkbox progress stays connected.

### 2 — Adjust a theme accent

- File: `dist/index.html`
- Task: Change Forest `--nav-accent` from `#7fd1a8` to `#8bd9b2`.
- Expected: selected navigation, focus accents, and the milestone ring use lighter green only in Forest mode.

### 3 — Rename a fixed reward consistently

- File: `dist/index.html`
- Task: Change the Cardio reward to `One homemade high-protein dessert` in the reward row and popup logic.
- Expected: both places agree; existing claimed state remains because its key is still `cardio`.

### 4 — Add one activity without shifting old IDs

- File: `dist/index.html`
- Task: Append `Five-minute mobility check-in` to Monday of Cardio Week 1.
- Expected: Monday has two activities. The jog remains `cardio-0-0`; the new task is `cardio-0-1`; completion totals increase by one.

### 5 — Change one unlock boundary

- File: `dist/index.html`
- Task: Make Block 1 available without completing the first three phases, while retaining the current rule for later blocks.
- Expected: General Fitness is available on a blank record; Block 2 and later remain locked.

## 9. Exercise solutions

### Solution 1

Change only the note in the Cardio call:

```js
addPhase('cardio','Cardio staircase',0,3,'Easy jogging · relaxed weekend walks',
```

### Solution 2

In the outer Forest selector, change:

```css
--nav-accent:#8bd9b2;
```

The CSS is compressed onto one line, so search rather than relying on line numbers.

### Solution 3

Keep `key:'cardio'` and change its reward-box label:

```js
{key:'cardio',label:'One homemade high-protein dessert',eligible:complete(p)}
```

Then change the Cardio branch in `milestoneReward(...)`:

```js
if (p.id === 'cardio') return 'One homemade high-protein dessert';
```

### Solution 4

Replace the concise Cardio callback with:

```js
addPhase(
  'cardio',
  'Cardio staircase',
  0,
  3,
  'Easy jogging · weekend walks included',
  (i, w, d) => {
    const tasks = [d < 5 ? 'Jog ' + km[w][d] + ' km' : 'Walk 5 km'];
    if (w === 0 && d === 0) tasks.push('Five-minute mobility check-in');
    return tasks;
  }
);
```

Appending preserves the old first item at position `0`.

### Solution 5

Change the boundary from 3 to 4:

```js
function unlocked(index) {
  return index < 4 || phases.slice(0, index).every(complete);
}
```

Block 1 is index `3`, so it becomes available. Block 2 is index `4`, so it still uses the completion rule.

## 10. Verification after a change

1. Confirm `git diff` contains only the intended edit and synchronised server copy.
2. Open `/`, `/foundation`, the changed phase route, and `/body-stats`.
3. Test desktop, 360-pixel, and 412-pixel widths.
4. Check and uncheck an activity, reload, and confirm the state returns.
5. Confirm the signed-in save status reports success.
6. Test relevant themes.
7. Check browser developer tools for JavaScript errors and horizontal overflow.
8. For programme/unlock changes, test both blank and completed records.
9. For PWA changes, clear the old service-worker cache before judging results.

A page looking correct is not proof that saving works. Saving is verified only after the API succeeds and the state survives reload.
