#!/usr/bin/env node
/**
 * SEO guardrail for the landing page, run after `next build` (see "build" in
 * package.json). Reads every prerendered page in .next/server/app and fails
 * the build when an indexable page is missing the basics:
 *
 * - exactly one <h1>
 * - a meta description of 110 to 160 characters that isn't the title
 * - an absolute, self-referencing canonical on this site's host
 * - og:url equal to the canonical, og:image and twitter:card
 * - at least one JSON-LD block that parses
 * - its URL in the built sitemap
 *
 * Pages with a robots noindex and Next's own error pages (_not-found,
 * _global-error) are skipped. The host comes from VERCEL_PROJECT_PRODUCTION_URL,
 * like src/lib/site-url.ts; unset (local, preview), it is http://localhost:3031.
 *
 * Usage: node scripts/check-seo.mjs   (from apps/landing-page, after a build)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".next", "server", "app");
const sitemapFile = join(appDir, "sitemap.xml.body");

/** Same rule as src/lib/site-url.ts. */
function siteUrl() {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return production ? `https://${production}` : "http://localhost:3031";
}

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&");
}

/** Attributes of every tag with this name, lowercased keys, decoded values. */
function tags(html, name) {
  const pattern = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  return [...html.matchAll(pattern)].map((match) => {
    const attributes = {};
    for (const attr of match[1].matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes[attr[1].toLowerCase()] = decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? "");
    }
    return attributes;
  });
}

function metaContent(html, key) {
  const found = tags(html, "meta").filter((meta) => meta.name === key || meta.property === key);
  return found.map((meta) => meta.content ?? "");
}

/** One spelling per URL, so https://host and https://host/ and https://host/a/ match https://host/a. */
function normalize(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.href;
}

function isAbsolute(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  });
}

/** index.html is /, about.html is /about, blog/post.html is /blog/post. */
function routeOf(file) {
  const path = relative(appDir, file).split(sep).join("/").replace(/\.html$/, "");
  return path === "index" ? "/" : `/${path.replace(/\/index$/, "")}`;
}

function checkPage(html, pageUrl, sitemapLocs) {
  const problems = [];

  const h1s = html.match(/<h1[\s>]/gi)?.length ?? 0;
  if (h1s !== 1) problems.push(`has ${h1s} <h1> elements, needs exactly one`);

  const title = decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  const descriptions = metaContent(html, "description");
  if (descriptions.length !== 1) {
    problems.push(`has ${descriptions.length} meta descriptions, needs exactly one`);
  } else {
    const description = descriptions[0].trim();
    if (description.length < 110 || description.length > 160) {
      problems.push(`meta description is ${description.length} characters, needs 110 to 160: "${description}"`);
    }
    if (description === title) problems.push("meta description is the same as the title");
  }

  const canonicals = tags(html, "link").filter((link) => (link.rel ?? "").toLowerCase().split(/\s+/).includes("canonical"));
  let canonical;
  if (canonicals.length !== 1) {
    problems.push(`has ${canonicals.length} canonical links, needs exactly one`);
  } else if (!isAbsolute(canonicals[0].href ?? "")) {
    problems.push(`canonical "${canonicals[0].href ?? ""}" is not an absolute URL`);
  } else {
    canonical = normalize(canonicals[0].href);
    if (canonical !== normalize(pageUrl)) problems.push(`canonical is ${canonicals[0].href}, should point to itself, ${pageUrl}`);
  }

  const ogUrls = metaContent(html, "og:url");
  if (ogUrls.length !== 1) problems.push(`has ${ogUrls.length} og:url tags, needs exactly one`);
  else if (canonical && (!isAbsolute(ogUrls[0]) || normalize(ogUrls[0]) !== canonical)) {
    problems.push(`og:url is ${ogUrls[0]}, should equal the canonical ${canonical}`);
  }

  if (!metaContent(html, "og:image").some((content) => content.trim())) problems.push("has no og:image");
  if (!metaContent(html, "twitter:card").some((content) => content.trim())) problems.push("has no twitter:card");

  const jsonLd = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  if (jsonLd.length === 0) problems.push("has no JSON-LD block");
  for (const [index, block] of jsonLd.entries()) {
    try {
      JSON.parse(block[1]);
    } catch (error) {
      problems.push(`JSON-LD block ${index + 1} doesn't parse: ${error.message}`);
    }
  }

  if (!sitemapLocs.has(normalize(pageUrl))) problems.push(`${pageUrl} is not in the sitemap`);

  return problems;
}

function main() {
  if (!existsSync(appDir)) {
    console.error(`check:seo: ${relative(process.cwd(), appDir)} not found. Run \`next build\` first.`);
    return 1;
  }
  if (!existsSync(sitemapFile)) {
    console.error("check:seo: no built sitemap (.next/server/app/sitemap.xml.body). Keep src/app/sitemap.ts.");
    return 1;
  }

  const origin = siteUrl();
  const sitemapLocs = new Set(
    [...readFileSync(sitemapFile, "utf8").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)]
      .map((match) => decodeEntities(match[1]))
      .filter(isAbsolute)
      .map(normalize),
  );

  let checked = 0;
  let failed = 0;
  for (const file of htmlFiles(appDir)) {
    const route = routeOf(file);
    if (route.split("/").some((segment) => segment.startsWith("_"))) continue;

    const html = readFileSync(file, "utf8");
    const robots = metaContent(html, "robots").join(",").toLowerCase();
    if (robots.includes("noindex")) continue;

    checked += 1;
    const pageUrl = new URL(route, origin).href;
    const problems = checkPage(html, pageUrl, sitemapLocs);
    if (problems.length > 0) {
      failed += 1;
      console.error(`\ncheck:seo: ${route} (${relative(process.cwd(), file)}) is missing SEO basics:`);
      for (const problem of problems) console.error(`  - ${problem}`);
    }
  }

  if (failed > 0) {
    console.error(`\ncheck:seo failed: ${failed} of ${checked} indexable page(s) need fixing (host ${origin}).`);
    console.error("Fix the page's metadata, or mark it noindex if it shouldn't be in search.");
    return 1;
  }
  if (checked === 0) {
    console.error("check:seo: found no indexable pages in .next/server/app, which can't be right.");
    return 1;
  }
  console.log(`check:seo passed: ${checked} indexable page(s) on ${origin}.`);
  return 0;
}

process.exitCode = main();
