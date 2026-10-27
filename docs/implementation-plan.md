# GitHub Pages adaptation

Goal: deliver an independent, upload-ready GitHub Pages project preserving the policy observatory's UI and all 83 configured sources. The existing Sites publication and its schedule remain untouched.

Architecture: Vite + React renders a public, versioned JSON snapshot. A Node.js collector runs in GitHub Actions, merges by canonical official URL, preserves historical entries and first-seen timestamps, writes atomically, then publishes static assets. No server API, D1 database, Sites identity, or credentials are required.

1. Test data merging, failed-source preservation, filtering/pagination, CSV safety, and repository-subpath URL handling before implementing the static data layer.
2. Reuse the source registry and tested crawler. Add bounded collection concurrency and per-source deadlines, source status history, input validation and atomic persistence.
3. Adapt the existing React interface to the static data layer and browser CSV exports. Preserve bookmarks and original links; do not retain root-relative /api dependencies.
4. Export real public records from the current website as initial data, including health and completed-run records.
5. Add an hourly GitHub Actions workflow (minute 0 of every hour), manual updates and deployment, plus read-only PR checks. Use the built-in GITHUB_TOKEN; commit only data updates. Publish only trusted default-branch runs.
6. Verify unit tests, TypeScript, production build, root and repository-subpath serving, and offline-independent runtime content. Deliver source and built-site archives without secrets, node_modules, private Site identifiers, or machine-specific paths.

Review focus: missing dates must remain unknown; failed fetches cannot erase old records; identical URLs cannot multiply; project subpaths must work for data, assets, home and shared links; public artifacts contain no write credentials.
