# Bin Organizer

A dependency-free static web app for finding things in storage bins.

- Create, rename, and delete bins, including empty bins and optional descriptions.
- Add, edit, and delete items with a required name, optional date, and multiple photos.
- Search item names, bin names, and bin descriptions using word fragments in any order (for example, “ki light” finds “kiwi polarized light”); each matching item appears under its bin.
- Save automatically in IndexedDB in the current browser.
- Import/export a versioned JSON backup containing all bins, items, and photos.

## Run locally

From this directory:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 in a modern browser. No installation or build is required. Keep using the same origin (hostname and port) to access your saved collection.

## Data and privacy

Inventory stays in your browser; the app makes no network requests for inventory or photos. Browser storage is not a backup or cloud sync: clearing site data, private browsing, browser eviction, or switching devices can lose access. Export backups regularly. Backups include unencrypted photos and inventory; store them somewhere private. Import replaces the collection after confirmation and validation. A failed save leaves the previous in-memory collection intact.

Photos are resized to at most 1400 pixels on the longest edge and re-encoded as JPEG. Each item supports up to 10 photos, each original up to 10 MB. Imports are capped at 100 MB. Browser storage capacity varies. Original full-resolution images are not preserved.

Use one tab at a time: simultaneous tabs can overwrite each other's changes. There is no login in this local version; anyone with access to your browser profile can see the collection.

## GitHub Pages

The app is ready for GitHub Pages without a build step:

1. Push this repository to GitHub.
2. In **Settings → Pages**, select **Deploy from a branch**, your branch, and **/(root)**.
3. Open the URL GitHub provides. Import a backup if moving inventory from localhost.

Only app source belongs in Git. Do not commit inventory exports or private pictures. The hosted app can be public while each visitor's inventory remains in their own browser. Hosting eligibility depends on your GitHub plan and repository visibility. See [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Optional cloud storage and login

For a later multi-device version, Supabase is a good fit alongside GitHub Pages: Postgres for bins/items, Auth for login, and private Storage for photos. Its [Free plan](https://supabase.com/pricing) currently includes limited database and file storage; check current quotas before adopting it. Free projects [can pause after a week of low activity](https://supabase.com/docs/guides/platform/free-project-pausing), which matters for an occasionally used inventory.

A secure implementation needs per-user ownership and row-level security on every inventory table, private photo buckets with matching ownership policies, and authenticated or short-lived signed photo URLs. The browser may contain a publishable key, but never a service-role key. Account setup, policies, migrations, and cloud synchronization are not implemented in this version. The static/local version avoids those dependencies and remains usable without an account.

## Verification

JavaScript syntax, backup validation, and conversion fidelity can be checked with Node. Browser interaction testing remains required. Suggested smoke test:

1. Create two bins, including one left empty; reload and verify persistence.
2. Add an item with a date and several photos, edit it, remove a photo, and open a photo at full size.
3. Search by item name and bin name; verify the bin association and no-results state.
4. Export, delete a bin, then import and verify items and photos are restored after reload.
5. Cancel replacement and try malformed JSON; verify the current collection stays intact.
6. Check keyboard navigation, required names, mobile layout, and deletion confirmations.

Bin descriptions are optional strings (up to 2000 characters). Existing version 1 backups without descriptions remain compatible. Descriptions are displayed on bin cards and included in search and backups.

To edit or delete a bin or item, swipe its header/name row to the left (or drag with a mouse). Swipe right or tap outside to close the actions. Keyboard users can focus the row and press Left Arrow to reveal actions, Tab to reach the buttons, and Escape or Right Arrow to close. The + button in each bin header always adds an item.

Bins include `addedAt` and `updatedAt` ISO date/time strings in backups. New bins receive both timestamps. Changing a bin's name or description, or adding/deleting an item, updates `updatedAt`; editing an existing item (including its pictures) does not. Saving unchanged bin details also leaves the timestamp unchanged. Older backups and existing browser data receive the current time for each missing timestamp, while supplied timestamps are preserved. Migrated browser data is saved so its timestamps remain stable on reload.

The Sort control defaults to Updated (newest first), with Added (newest first) and Name (alphabetical) options. Timestamp ties sort by name; name ties sort by ID. Sorting changes only the display order.

Run the timestamp and sorting regression checks with `node --test tests/bin-metadata.test.cjs`.
