#!/usr/bin/env node
/**
 * Tells IndexNow (Bing, Yandex, Seznam, Naver and others) that the landing
 * page's URLs changed, so they recrawl them soon instead of on their own
 * schedule. Runs after each production deploy of the landing page
 * (.github/workflows/landing-indexnow.yml).
 *
 * Reads the live sitemap, takes every <loc> on our host and POSTs them to
 * IndexNow with the key in public/<key>.txt, which proves we own the host.
 *
 * Usage: node scripts/indexnow.mjs [--dry-run]
 *   --dry-run  print the URLs it would submit, without calling IndexNow.
 *
 * A failed ping is logged, never fatal: it must not fail a deploy or a run.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "www.ledachat.com";
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const TIMEOUT_MS = 20_000;

const dryRun = process.argv.includes("--dry-run");
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** The key is the name (and content) of the one 32 hex character .txt file in public/. */
function readKey() {
  const files = readdirSync(publicDir).filter((name) => /^[0-9a-f]{32}\.txt$/.test(name));
  if (files.length !== 1) throw new Error(`expected one IndexNow key file in public/, found ${files.length}`);
  const key = files[0].slice(0, -4);
  const content = readFileSync(join(publicDir, files[0]), "utf8").trim();
  if (content !== key) throw new Error(`public/${files[0]} must contain exactly its own name, the key`);
  return key;
}

async function sitemapUrls() {
  const response = await fetch(SITEMAP_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`GET ${SITEMAP_URL} returned ${response.status}`);
  const xml = await response.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  // IndexNow rejects a batch with a URL on another host, so keep only ours.
  return [...new Set(locs)].filter((url) => {
    try {
      return new URL(url).host === HOST;
    } catch {
      return false;
    }
  });
}

async function main() {
  const key = readKey();
  const urlList = await sitemapUrls();
  if (urlList.length === 0) {
    console.log(`IndexNow: no ${HOST} URLs in ${SITEMAP_URL}, nothing to submit.`);
    return;
  }

  if (dryRun) {
    console.log(`IndexNow dry run: would submit ${urlList.length} URL(s) for ${HOST} with key ${key}:`);
    for (const url of urlList) console.log(`  ${url}`);
    return;
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // 200 OK and 202 Accepted (key check pending) are both success.
  if (response.ok) {
    console.log(`IndexNow: submitted ${urlList.length} URL(s), HTTP ${response.status}.`);
    for (const url of urlList) console.log(`  ${url}`);
  } else {
    const body = await response.text().catch(() => "");
    console.log(`IndexNow: ping failed, HTTP ${response.status}. ${body.slice(0, 500)}`);
  }
}

try {
  await main();
} catch (error) {
  console.log(`IndexNow: ping skipped or failed: ${error instanceof Error ? error.message : String(error)}`);
}
process.exitCode = 0;
