# Sharing a test build

The player is a static site: `npm run build` writes `dist/` (page, script, `bundle.json`, `robots.txt`, `_headers`). It runs from any static host, also under a subpath, with no server code. The repo stays private; only `dist/` is uploaded.

Anyone with the link can open the site and read the whole content bundle. The build asks search engines to stay away (`noindex` meta tag, `robots.txt`, an `X-Robots-Tag` header), but that does not protect it. When access must be limited, use Cloudflare Pages with Access (below).

## Netlify (current choice)

1. `npm run check`, then `npm run build`.
2. First time: open <https://app.netlify.com/drop> and drag the `dist/` folder onto the page. Netlify gives the site a link; rename it under Site configuration if you like.
3. Updates: on the site's **Deploys** page, drag `dist/` onto the drop zone again (same link). With the CLI: `npx netlify-cli deploy --prod --dir dist`.

## Cloudflare Pages with Access (when only invited people may open it)

1. `npx wrangler pages deploy dist --project-name <name>`. The first run asks you to log in and creates the project at `<name>.pages.dev`.
2. In the Cloudflare dashboard: **Zero Trust → Access → Applications → Add an application → Self-hosted**. Domain: `<name>.pages.dev` (add `*.<name>.pages.dev` too, so the preview links are covered as well).
3. Add a policy: Action *Allow*, Include *Emails*, and list the testers' addresses. Login method: *One-time PIN*. Testers get a code by email; no account needed. Free for up to 50 users.

## How testers send feedback

1. On first start the app says that this is a test build and that no mechanic has checked the steps.
2. On any step or check, testers tap **Note** and write what is unclear, wrong or missing. Notes stay on the phone.
3. When they are done: **Notes** tab → **Copy all** (or **Share**) → paste into a message or email to you.

Each note carries the flow, the step or check id, its review unit id (for example `card:step:check-high-limit`), the path so far, the bike's facts and the content hash. The unit id matches `build/review/` and `reviews/ledger.yaml`, so an agent can find the card the note is about. A doubt about mechanics goes to `content/review/<job>.md`, not into the content.
