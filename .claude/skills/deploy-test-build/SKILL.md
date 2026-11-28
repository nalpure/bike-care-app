---
name: deploy-test-build
description: Publish or update the player's test build for testers (Netlify now; Cloudflare Pages with Access when only invited people may open it). Use only when the owner asks in this session for the test build to go online.
---

# Deploy the test build

Publishing is outward-facing (hard rule 8): do it only when the owner asked for it in this session, and never make the repo public. Only `dist/` is uploaded; anyone with the link can read the whole content bundle. The hosts, first-time setup and tester feedback are described for the owner in `docs/sharing.md`. In the Bash tool prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`.

1. Work from a clean, pushed `main`. Run the `verify` skill (at least `npm run check` and `npm test`).
2. `npm run build`. Confirm `dist/` holds `index.html`, `bundle.json`, `robots.txt` and `_headers`, and that `index.html` has the robots `noindex` meta tag.
3. **Netlify** (current host): `npx netlify-cli deploy --prod --dir dist`. It needs the owner's Netlify login and the linked site; if either is missing, stop and ask the owner to drag `dist/` onto the site's Deploys page instead (`docs/sharing.md`).
4. **Cloudflare Pages with Access** (only if the owner asked for a gated build): `npx wrangler pages deploy dist --project-name <name>`, then the Access policy in `docs/sharing.md`, which the owner sets in the dashboard.
5. Open the link and check that the app starts and shows the test-build notice (no mechanic has checked the steps).
6. Report the link, the commit it was built from and the bundle's `content_hash`. Run `npm run clean` afterwards.
