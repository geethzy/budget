# PiggyPlan

A minimalist expense and monthly budget tracker in LKR. It is a Progressive Web App built with plain HTML, CSS and JavaScript modules, with no framework and no build step. Data is stored on the device only.

## Features
- Add an expense in a few taps: amount, category, date (calendar picker).
- Calendar tab: see each day's expenses, edit or delete them.
- Overview tab: remaining budget for the month and progress per category.
- Monthly budget of Rs 50,000 split across Grocery, Transport, Bills, Outings and Shopping (edit in `src/data/config.js`).
- Export and import expenses as JSON backup.
- Works offline once loaded (service worker).

## Run locally
ES modules need a web server, so do not open `index.html` by double-clicking it.

```bash
npm start            # serves at http://localhost:8000
npm test             # runs the test suite (Node 18+)
```

## Install on iPhone
Host the folder (see below), open the link in Safari, then Share → Add to Home Screen.

## Deploy
GitHub Pages works well: push this repo, then Settings → Pages → deploy from the `main` branch root. The app uses relative paths, so it works from a sub-path.

## Architecture
The layers follow the same pattern as the Meal Mate app.

| Folder | Layer | Responsibility |
|---|---|---|
| `src/data/` | Data | Static config, and the only code that touches localStorage and backup files |
| `src/core/` | Logic | Pure functions: validation, dates, budget maths. No DOM, no storage |
| `src/app/` | Controller | State, named actions, and view models (plain data) |
| `src/ui/` | UI | HTML generation only. Escapes all user text |
| `src/main.js` | Composition root | Wires the layers together and listens to events |

Data flows one way: event → `dispatch(action)` → state and storage → `view()` → HTML.

## Data and privacy
- Expenses are stored in the browser's localStorage under `expense-tracker-v2`. Clearing site data erases them, so export a backup regularly.
- Nothing is sent to a server. Backup files contain your full expense history, so keep them out of public repositories (see `.gitignore`).

## Known limits
- Notifications (the 9 AM check and SMS alerts) are not part of the web app. They are set up in the iOS Shortcuts app.
- Data is per device. Use Export and Import to move it.
- `apple-touch-icon.png` (180 × 180) is referenced but not included. Add it to `icons/` for the best home-screen icon.

## Pre-fill from a link
Opening the app with query parameters fills in the Add form, but never saves:

```
https://YOUR-USERNAME.github.io/expense-tracker/?amount=1250&cat=bills&date=2026-11-24
```

- `amount` (required to trigger): digits, for example `1250`
- `cat`: `grocery`, `transport`, `bills`, `outings` or `shopping`
- `date`: `YYYY-MM-DD`, defaults to today

The parameters are removed from the address bar after they are read. This is how the iOS Shortcut logs an SMS with one tap.
