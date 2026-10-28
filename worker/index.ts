import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Buffer } from 'node:buffer';

const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_DATA = 8 * 1024 * 1024;
const SHA = /^[a-f0-9]{40}$/;
const IMAGE_PATH = /^images\/[\w.-]+\.(?:png|jpe?g|webp|gif|avif)$/i;
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif'
};
// Cached public signing keys, never user tokens or request state.
const signingKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' }
});
function check(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new HttpError(status, message);
}

// A bounded streaming read also covers requests without Content-Length.
async function readLimited(body: ReadableStream<Uint8Array> | null, limit: number) {
  check(body, 'Empty request');
  const reader = body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new HttpError(413, 'File is too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length);
}

export async function authenticate(request: Request, env: Env) {
  check(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD && env.EDITOR_EMAIL && env.GITHUB_TOKEN,
    'Online editor setup is incomplete. Configure Access and the GitHub secret.', 503);
  check(/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN), 'Invalid Access configuration', 503);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  check(token, 'Sign in to use the editor.', 401);
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  try {
    let keys = signingKeys.get(issuer);
    if (!keys) { keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)); signingKeys.set(issuer, keys); }
    const { payload } = await jwtVerify(token, keys, {
      issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email']
    });
    check(typeof payload.email === 'string' && payload.email.toLowerCase() === env.EDITOR_EMAIL.toLowerCase(),
      'This account cannot edit this map.', 403);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'Your sign-in has expired. Reload the editor to sign in again.');
  }
}

async function github(env: Env, path: string, method = 'GET', body?: unknown, raw = false) {
  check(/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY), 'Invalid repository configuration', 503);
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'Atlas-Tamaki-Editor',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 409 || response.status === 422) throw new HttpError(409,
      'The repository changed. Export a backup of your edits, then reload before publishing.');
    if (response.status === 404) throw new HttpError(404, 'File or repository not found.');
    throw new HttpError(502, `GitHub could not complete the request (${response.status}). Your edits have not been discarded.`);
  }
  return response;
}
async function ghJSON<T>(env: Env, path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await github(env, path, method, body);
  return JSON.parse((await readLimited(response.body, MAX_DATA)).toString('utf8')) as T;
}
const branchPath = (env: Env) => env.GITHUB_BRANCH.split('/').map(encodeURIComponent).join('/');
async function head(env: Env) {
  const ref = await ghJSON<{object: {sha: string}}>(env, `git/ref/heads/${branchPath(env)}`);
  return ref.object.sha;
}
async function contents(env: Env, path: string, ref: string) {
  return github(env, `contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`, 'GET', undefined, true);
}

type ImageData = {file?: string; center: number[]; wm: number; rot?: number; [key: string]: unknown};
type Idea = {slug: string; title: string; category: string; description: string; images: ImageData[]; [key: string]: unknown};
type Atlas = {categories: Record<string, {label: string; color: string; about?: string}>; ideas: Idea[]};
type Upload = {path: string; sha: string};
type Publish = {base: string; data: Atlas; uploads: Upload[]};

export function validateData(data: Atlas) {
  check(data && typeof data === 'object' && data.categories && typeof data.categories === 'object'
    && !Array.isArray(data.categories) && Array.isArray(data.ideas), 'Invalid map data');
  check(data.ideas.length <= 5000 && Object.keys(data.categories).length <= 50, 'Map is too large');
  for (const [key, category] of Object.entries(data.categories)) {
    check(/^[\w-]+$/.test(key) && category && typeof category.label === 'string'
      && /^#[a-f0-9]{6}$/i.test(category.color), 'Invalid category');
  }
  const slugs = new Set();
  for (const idea of data.ideas) {
    check(idea && /^[\w-]+$/.test(idea.slug) && !slugs.has(idea.slug), 'Idea addresses must be unique');
    slugs.add(idea.slug);
    check(typeof idea.title === 'string' && typeof idea.description === 'string'
      && Object.hasOwn(data.categories, idea.category) && Array.isArray(idea.images), 'Invalid idea');
    for (const image of idea.images) {
      check(image && Array.isArray(image.center) && image.center.length === 2
        && image.center.every(Number.isFinite) && Math.abs(image.center[0]) <= 180
        && Math.abs(image.center[1]) <= 90 && Number.isFinite(image.wm) && image.wm > 0
        && (image.rot === undefined || Number.isFinite(image.rot)), 'Invalid image placement');
      check(!image.file || (typeof image.file === 'string' && (IMAGE_PATH.test(image.file)
        || /^https:\/\//.test(image.file) || /^data:image\/(png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(image.file))), 'Invalid image path');
    }
  }
}

// Git blobs are uploaded first. Only the final fast-forward makes the data and
// all referenced pictures visible, together. No database or staging bucket.
async function upload(request: Request, env: Env) {
  const mime = request.headers.get('Content-Type')?.split(';')[0].toLowerCase() || '';
  check(IMAGE_TYPES[mime], 'Use a PNG, JPEG, WebP, GIF or AVIF picture.');
  const bytes = await readLimited(request.body, MAX_IMAGE);
  check(bytes.length, 'Empty picture');
  // Check signatures so an HTML or SVG upload cannot run code on this origin.
  const detected = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
    : /^GIF8[79]a/.test(bytes.subarray(0,6).toString()) ? 'image/gif'
    : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' ? 'image/webp'
    : bytes.subarray(4,8).toString() === 'ftyp' && /avif|avis/.test(bytes.subarray(8,40).toString()) ? 'image/avif' : '';
  check(mime === detected, 'The picture format does not match its file type.');
  const blob = await ghJSON<{sha: string}>(env, 'git/blobs', 'POST', {content: bytes.toString('base64'), encoding: 'base64'});
  return json({path: `images/upload-${blob.sha}.${IMAGE_TYPES[mime]}`, sha: blob.sha});
}

async function publish(request: Request, env: Env) {
  let input: Publish;
  try { input = JSON.parse((await readLimited(request.body, MAX_DATA)).toString('utf8')); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid publish request'); }
  check(input && SHA.test(input.base) && Array.isArray(input.uploads), 'Invalid publish request');
  validateData(input.data);
  check(await head(env) === input.base,
    'The repository changed since this editor was opened. Export a backup of your edits, then reload before publishing.', 409);
  const parent = await ghJSON<{tree: {sha: string}}>(env, `git/commits/${input.base}`);
  const files = new Set(input.data.ideas.flatMap(i => i.images.map(im => im.file).filter(Boolean)));
  const uploads = new Map<string, string>();
  for (const item of input.uploads) {
    check(item && SHA.test(item.sha) && IMAGE_PATH.test(item.path)
      && item.path.startsWith(`images/upload-${item.sha}.`), 'Invalid image upload');
    if (files.has(item.path)) uploads.set(item.path, item.sha);
  }
  // Validate every local reference against the tree we read, including uploads
  // restored by undo and edits imported from an older export.
  const existing = await ghJSON<{tree: {path: string; type: string}[]; truncated: boolean}>(env, `git/trees/${parent.tree.sha}?recursive=1`);
  check(!existing.truncated, 'Repository listing is too large to verify safely.', 502);
  const existingPaths = new Set(existing.tree.filter(e => e.type === 'blob').map(e => e.path));
  for (const file of files) if (file?.startsWith('images/')) {
    check(existingPaths.has(file) || uploads.has(file), `Picture is missing: ${file}. Replace it before publishing.`);
  }
  const text = '// Atlas Tāmaki data, saved by the online editor.\nwindow.ATLAS = '
    + JSON.stringify(input.data, null, 2) + ';\n';
  const tree = await ghJSON<{sha: string}>(env, 'git/trees', 'POST', {
    base_tree: parent.tree.sha,
    tree: [
      {path: 'ideas.js', mode: '100644', type: 'blob', content: text},
      ...[...uploads].map(([path, sha]) => ({path, sha, mode: '100644', type: 'blob'}))
    ]
  });
  const commit = await ghJSON<{sha: string}>(env, 'git/commits', 'POST', {
    message: 'Publish Atlas Tāmaki edits', tree: tree.sha, parents: [input.base]
  });
  // If another writer won the race, force:false rejects the divergent commit.
  await ghJSON(env, `git/refs/heads/${branchPath(env)}`, 'PATCH', {sha: commit.sha, force: false});
  return json({commit: commit.sha, publicURL: env.PUBLIC_URL});
}

async function publishingStatus(request: Request, env: Env) {
  const commit = new URL(request.url).searchParams.get('commit') || '';
  check(SHA.test(commit), 'Invalid publication');
  const result = await ghJSON<{workflow_runs: {id: number; head_sha: string; status: string; conclusion: string | null; html_url: string}[]}>(
    env, `actions/workflows/pages.yml/runs?head_sha=${commit}&per_page=5`);
  const run = result.workflow_runs.find(r => r.head_sha === commit);
  return json({state: !run ? 'queued' : run.status !== 'completed' ? 'publishing'
    : run.conclusion === 'success' ? 'live' : 'failed', url: run?.html_url, publicURL: env.PUBLIC_URL});
}

export async function handleRequest(request: Request, env: Env) {
  const url = new URL(request.url), path = url.pathname;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    check(request.headers.get('Origin') === url.origin, 'This request must come from the editor.', 403);
    check(request.headers.get('X-Atlas-Editor') === '1', 'Invalid editor request', 403);
  }
  if (request.method === 'GET' && path === '/__editor') return json({ok: true, mode: 'github', publicURL: env.PUBLIC_URL});
  if (request.method === 'POST' && path === '/api/images') return upload(request, env);
  if (request.method === 'POST' && path === '/api/publish') return publish(request, env);
  if (request.method === 'GET' && path === '/api/publish-status') return publishingStatus(request, env);
  check(request.method === 'GET' || request.method === 'HEAD', 'Method not allowed', 405);
  if (path === '/ideas.js') {
    const revision = await head(env);
    const data = await contents(env, 'ideas.js', revision);
    const text = (await readLimited(data.body, MAX_DATA)).toString('utf8');
    return new Response(`${text}\nwindow.ATLAS_REVISION = ${JSON.stringify(revision)};\n`, {
      headers: {'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store'}
    });
  }
  if (path === '/image-manifest.js') {
    // Existing assets are content addressed; new pictures use original fallback
    // until the next editor deployment includes their optimized variants.
    return env.ASSETS.fetch(request);
  }
  if (/^\/images\/optimized\/[a-f0-9]{16}-(320|960|2048)\.webp$/.test(path)) return env.ASSETS.fetch(request);
  if (path.startsWith('/images/')) {
    const file = decodeURIComponent(path.slice(1));
    check(IMAGE_PATH.test(file), 'Picture not found', 404);
    const revision = url.searchParams.get('rev');
    check(!revision || SHA.test(revision), 'Invalid image revision');
    const response = await contents(env, file, revision || env.GITHUB_BRANCH);
    const ext = file.split('.').pop()?.toLowerCase();
    return new Response(request.method === 'HEAD' ? null : response.body, {headers: {
      'Content-Type': ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`,
      'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff'
    }});
  }
  check(!path.startsWith('/api/'), 'Not found', 404);
  if (path === '/') url.pathname = '/editor.html';
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      await authenticate(request, env);
      const response = await handleRequest(request, env);
      const secured = new Response(response.body, response);
      secured.headers.set('Cache-Control', 'no-store');
      secured.headers.set('X-Content-Type-Options', 'nosniff');
      secured.headers.set('Referrer-Policy', 'same-origin');
      secured.headers.set('X-Frame-Options', 'DENY');
      return secured;
    } catch (error) {
      if (error instanceof HttpError) return json({error: error.message}, error.status);
      console.error(JSON.stringify({event: 'editor_request_failed', message: error instanceof Error ? error.message : 'Unknown error'}));
      return json({error: 'Could not reach the publishing service. Your edits are still in this tab. Try again.'}, 502);
    }
  }
} satisfies ExportedHandler<Env>;
