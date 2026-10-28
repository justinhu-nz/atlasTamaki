# Online editor

The public map stays on GitHub Pages. A separate Cloudflare Worker serves the
existing editor behind Cloudflare Access, reads current ideas from GitHub, and
publishes edits and new pictures in a single commit. No database is required.

Only `hujustinnz@outlook.com` is authorized. The Worker verifies the signature,
issuer, audience, expiry and email on every Access JWT, including requests for
static assets. Missing configuration fails closed. Preview URLs are disabled.

Reserved editor URL: <https://atlas-tamaki-editor.hujustinapple.workers.dev/>.
It remains locked until the Access configuration and GitHub secret are set.

## One-time setup

1. Install dependencies with `npm ci`. Sign in using `npx wrangler login`.
2. In Cloudflare Zero Trust, create a team and enable the **One-time PIN** login
   method. Note its team domain, such as `your-team.cloudflareaccess.com`.
3. Set `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`. Reserve the Worker address with
   `npm run cf:bootstrap`. It returns a setup
   error until Access and the GitHub secret are configured; it exposes no editor.
4. In **Workers & Pages → atlas-tamaki-editor → Access**, protect this Worker's
   **All traffic**. Configure the resulting Access application in Zero Trust.
   Allow only the exact email `hujustinnz@outlook.com`, using One-time PIN.
   Choose an application session duration suitable for your personal device.
   Do not add an Everyone, Bypass, or service-token policy.
   The Worker also verifies JWTs itself, so unprotected alternative URLs cannot
   bypass its authorization checks.
5. Copy the Access application's **Application Audience (AUD)** into
   `ACCESS_AUD` in `wrangler.jsonc`. Run `npm run cf:types` after changing config.
6. Create a fine-grained GitHub personal access token restricted to the
   `justinhu-nz/atlasTamaki` repository, with **Contents: Read and write** and
   **Actions: Read**. Set an expiry you can maintain. Add it securely with
   `npx wrangler secret put GITHUB_TOKEN`; paste it only into that prompt.
   Alternatively, in the Worker's Settings, add a Production variable named
   `GITHUB_TOKEN`, check **Secret**, paste the token, and deploy. Never put it in
   source, the public editor, chat, or this document.
7. Deploy again with `npm run cf:deploy`.
8. Commit/push the implementation, including `.github/workflows/pages.yml`.
   In GitHub repository **Settings → Pages → Build and deployment**, select
   **GitHub Actions**. Run **Publish public map** once to verify deployment.
9. Open the Worker URL. Sign in with the email code, paste a test picture, and
   publish. Confirm **Published. Your map is live.** and view the public map.

The first live deployment needs both the Cloudflare login and the repository
token. The GitHub connector used by a coding assistant does not automatically
provide a credential that can be installed in a Worker.

## Daily use

Open the private Worker URL, edit, and click **Publish changes** (or ⌘S/Ctrl+S).
Pictures upload automatically. Publish waits until pictures finish uploading.
The editor confirms when GitHub has saved the commit, then when Pages is live.
Login is required again when the Access session expires.

The existing public `editor.html` continues to offer offline/download export;
use the Worker URL for online publishing. **View map** in the private editor
opens the public GitHub Pages URL.

## Saving and failure handling

- Pictures are staged as Git blobs, without advancing the branch. Publish
  verifies all local picture references, then creates a single Git tree/commit
  containing `ideas.js` and all newly used pictures. Unused uploads are omitted.
- A publish is based on the repository revision loaded by that tab. If another
  tab or a Git push has changed it, the editor refuses to overwrite it. A second
  concurrent publisher is also rejected by the non-forced branch update.
- Unsaved edits and newly pasted pictures live in the tab until published.
  Closing/reloading warns about unsaved changes. On publishing errors,
  **Export backup** downloads an ideas file containing the new image bytes.
  Keep that file before reloading; it can replace `ideas.js` locally for recovery.
- The public map changes only after a successful Pages build. Failed builds
  leave the previous deployment online. Publishing status links to the run.
- If a response is interrupted after the commit was saved, a retry may report
  a conflict. Export a backup and reload to inspect the repository's saved copy.
- The Pages workflow generates optimized images inside its artifact, without
  making another Git commit. Public images remain optimized. Existing editor
  images use packaged optimized assets; newly published images use original
  fallback until the next editor deployment. Originals are limited to 15 MiB.

## Development and verification

```
npm ci
npm test
npm run typecheck
npm run cf:check
```

`npm run cf:dev` runs the real Worker locally. It still requires a valid Access
JWT and configuration; there is deliberately no production authentication
bypass. For editing locally without Cloudflare, use `python3 server.py`.

Browser checks require Playwright and Chrome/Chromium. With the local server
running:

```
ATLAS_URL=http://127.0.0.1:8765/ node tests/browser-clipboard.cjs
ATLAS_URL=http://127.0.0.1:8765/ node tests/browser-online.cjs
```

Set `CHROME_PATH` if the Playwright browser is not installed. Browser online
checks intercept write requests and do not modify repository data. Worker tests
mock GitHub and use signed test JWTs; they make no external writes.

Run `npm run cf:deploy` again when changing editor code. Content-only publishing
does not need a Worker deployment because it loads current ideas from GitHub.
