import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import worker, { handleRequest, validateData } from '../worker/index.ts';

const BASE = 'a'.repeat(40), NEXT = 'b'.repeat(40), IMAGE = 'c'.repeat(40), TREE = 'd'.repeat(40);
const origin = 'https://editor.example.com';
const data = JSON.parse((await readFile(new URL('../ideas.js', import.meta.url), 'utf8')).split('window.ATLAS =')[1].trim().replace(/;$/, ''));
const env = {
  GITHUB_REPOSITORY: 'justinhu-nz/atlasTamaki', GITHUB_BRANCH: 'main', GITHUB_TOKEN: 'test-secret',
  PUBLIC_URL: 'https://justinhu-nz.github.io/atlasTamaki/',
  EDITOR_EMAIL: 'hujustinnz@outlook.com', ACCESS_TEAM_DOMAIN: 'atlas-test.cloudflareaccess.com', ACCESS_AUD: 'test-audience',
  ASSETS: {fetch: async request => new Response(new URL(request.url).pathname)}
};
function request(path, body, method = 'POST') {
  return new Request(origin + path, {method, headers: {
    Origin: origin, 'X-Atlas-Editor': '1', 'Content-Type': 'application/json'
  }, body: body === undefined ? undefined : JSON.stringify(body)});
}
function githubMock({race = false, failUpload = false, conclusion = 'success'} = {}) {
  const state = {head: BASE, calls: [], visible: new Set(data.ideas.flatMap(i => i.images.map(im => im.file))), tree: null, body: null};
  const fetch = async (url, options) => {
    assert.match(url, /^https:\/\/api.github.com\/repos\/justinhu-nz\/atlasTamaki\//);
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    const path = url.split('/atlasTamaki/')[1], method = options.method;
    const body = options.body ? JSON.parse(options.body) : undefined;
    state.calls.push({path, method, body});
    if (path === 'git/ref/heads/main') return Response.json({object: {sha: state.head}});
    if (path === `git/commits/${BASE}`) return Response.json({tree: {sha: TREE}});
    if (path.startsWith('git/trees/') && method === 'GET') return Response.json({tree: [...state.visible].map(path => ({path, type: 'blob'})), truncated: false});
    if (path === 'git/blobs') return failUpload ? new Response('', {status: 500}) : Response.json({sha: IMAGE});
    if (path === 'git/trees') {state.tree = body; return Response.json({sha: TREE});}
    if (path === 'git/commits') {state.body = body; return Response.json({sha: NEXT});}
    if (path === 'git/refs/heads/main') {
      assert.equal(body.force, false);
      if (race) return new Response('', {status: 422});
      assert.deepEqual(state.body.parents, [BASE]);
      for (const entry of state.tree.tree) state.visible.add(entry.path);
      state.head = body.sha;
      return Response.json({object: {sha: state.head}});
    }
    if (path.startsWith('contents/ideas.js')) return new Response(`window.ATLAS = ${JSON.stringify(data)};`);
    if (path.startsWith('actions/workflows/pages.yml/runs')) return Response.json({workflow_runs: [{head_sha: NEXT, status: 'completed', conclusion, html_url: 'https://github.com/justinhu-nz/atlasTamaki/actions/runs/1'}]});
    throw new Error(`Unexpected GitHub request: ${method} ${path}`);
  };
  return {state, fetch};
}

test('current catalogue passes validation; unsafe image paths and duplicate addresses fail', () => {
  validateData(data);
  const invalid = structuredClone(data);
  invalid.ideas[0].images[0].file = '../worker/index.ts';
  assert.throws(() => validateData(invalid), /Invalid image path/);
  invalid.ideas[0].images[0].file = 'javascript:alert(1)';
  assert.throws(() => validateData(invalid), /Invalid image path/);
  invalid.ideas = [data.ideas[0], data.ideas[0]];
  assert.throws(() => validateData(invalid), /unique/);
});

test('upload is staged; publish makes pictures and data visible in one fast-forward', async t => {
  const mock = githubMock(); t.mock.method(globalThis, 'fetch', mock.fetch);
  const upload = await handleRequest(new Request(origin + '/api/images', {
    method: 'POST', headers: {Origin: origin, 'X-Atlas-Editor': '1', 'Content-Type': 'image/png'},
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
  }), env);
  const image = await upload.json();
  assert.equal(image.path, `images/upload-${IMAGE}.png`);
  assert.equal(mock.state.head, BASE);
  assert.equal(mock.state.visible.has(image.path), false);
  const updated = structuredClone(data);
  updated.ideas[0].images[0].file = image.path;
  const response = await handleRequest(request('/api/publish', {base: BASE, data: updated, uploads: [image]}), env);
  assert.equal((await response.json()).commit, NEXT);
  assert.equal(mock.state.head, NEXT);
  assert.equal(mock.state.visible.has(image.path), true);
  assert.equal(mock.state.tree.base_tree, TREE);
  assert.equal(mock.state.tree.tree.length, 2);
  assert.match(mock.state.tree.tree[0].content, /window.ATLAS =/);
});

test('an outdated tab cannot overwrite a later commit', async t => {
  const mock = githubMock(); mock.state.head = NEXT; t.mock.method(globalThis, 'fetch', mock.fetch);
  await assert.rejects(handleRequest(request('/api/publish', {base: BASE, data, uploads: []}), env), error => error.status === 409);
  assert.equal(mock.state.calls.filter(c => c.method !== 'GET').length, 0);
});

test('a concurrent publish is rejected without force-updating the branch', async t => {
  const mock = githubMock({race: true}); t.mock.method(globalThis, 'fetch', mock.fetch);
  await assert.rejects(handleRequest(request('/api/publish', {base: BASE, data, uploads: []}), env), error => error.status === 409);
  assert.equal(mock.state.head, BASE);
});

test('missing picture prevents any commit', async t => {
  const mock = githubMock(); t.mock.method(globalThis, 'fetch', mock.fetch);
  const changed = structuredClone(data); changed.ideas[0].images[0].file = 'images/missing.png';
  await assert.rejects(handleRequest(request('/api/publish', {base: BASE, data: changed, uploads: []}), env), /Picture is missing/);
  assert.equal(mock.state.calls.filter(c => c.method !== 'GET').length, 0);
});

test('failed image upload never moves the branch', async t => {
  const mock = githubMock({failUpload: true}); t.mock.method(globalThis, 'fetch', mock.fetch);
  await assert.rejects(handleRequest(new Request(origin + '/api/images', {
    method: 'POST', headers: {Origin: origin, 'X-Atlas-Editor': '1', 'Content-Type': 'image/jpeg'}, body: new Uint8Array([255,216,255,1])
  }), env), /GitHub could not complete/);
  assert.equal(mock.state.head, BASE);
});

test('reject cross-site requests, oversized uploads and disguised HTML', async () => {
  await assert.rejects(handleRequest(new Request(origin + '/api/publish', {method: 'POST'}), env), error => error.status === 403);
  await assert.rejects(handleRequest(new Request(origin + '/api/images', {
    method: 'POST', headers: {Origin: origin, 'X-Atlas-Editor': '1', 'Content-Type': 'image/png'}, body: '<script>alert(1)</script>'
  }), env), /format/);
  await assert.rejects(handleRequest(new Request(origin + '/api/images', {
    method: 'POST', headers: {Origin: origin, 'X-Atlas-Editor': '1', 'Content-Type': 'image/png'}, body: new Uint8Array(15 * 1024 * 1024 + 1)
  }), env), error => error.status === 413);
});

test('editor always reads latest repository data and exposes its revision', async t => {
  const mock = githubMock(); t.mock.method(globalThis, 'fetch', mock.fetch);
  const response = await handleRequest(new Request(origin + '/ideas.js'), env);
  assert.match(await response.text(), new RegExp(`window.ATLAS_REVISION = "${BASE}"`));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('publication status distinguishes live from failed deployments', async t => {
  for (const conclusion of ['success', 'failure']) {
    const mock = githubMock({conclusion}); t.mock.method(globalThis, 'fetch', mock.fetch);
    const response = await handleRequest(new Request(origin + `/api/publish-status?commit=${NEXT}`), env);
    assert.equal((await response.json()).state, conclusion === 'success' ? 'live' : 'failed');
  }
});

test('all assets and write endpoints require a valid Access JWT for the one editor', async t => {
  const {privateKey, publicKey} = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey); jwk.kid = 'test-key'; jwk.alg = 'RS256'; jwk.use = 'sig';
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(String(url), 'https://atlas-test.cloudflareaccess.com/cdn-cgi/access/certs');
    return Response.json({keys: [jwk]});
  });
  const token = async (email, audience = env.ACCESS_AUD, expiration = '1h') => new SignJWT({email})
    .setProtectedHeader({alg: 'RS256', kid: 'test-key'}).setSubject('editor').setIssuedAt()
    .setIssuer('https://' + env.ACCESS_TEAM_DOMAIN).setAudience(audience).setExpirationTime(expiration).sign(privateKey);
  for (const path of ['/', '/editor.js', '/__editor', '/api/publish']) {
    assert.equal((await worker.fetch(new Request(origin + path), env)).status, 401);
  }
  for (const [email, audience, expiration] of [
    ['someone@example.com', env.ACCESS_AUD, '1h'],
    [env.EDITOR_EMAIL, 'wrong-audience', '1h'],
    [env.EDITOR_EMAIL, env.ACCESS_AUD, 1]
  ]) {
    const response = await worker.fetch(new Request(origin + '/__editor', {headers: {'Cf-Access-Jwt-Assertion': await token(email, audience, expiration)}}), env);
    assert.ok([401,403].includes(response.status));
  }
  const signedIn = new Request(origin + '/__editor', {headers: {'Cf-Access-Jwt-Assertion': await token(env.EDITOR_EMAIL)}});
  assert.equal((await worker.fetch(signedIn, env)).status, 200);
  assert.equal((await worker.fetch(signedIn, {...env, ACCESS_AUD: ''})).status, 503);
});
