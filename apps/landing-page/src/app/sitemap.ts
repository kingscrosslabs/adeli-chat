import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type { MetadataRoute } from "next";

import { getAllPosts } from "@/lib/blog/posts";
import { siteUrl } from "@/lib/site-url";

/** Files whose changes change what the homepage says. Paths are relative to apps/landing-page, the build's working directory. */
const HOMEPAGE_CONTENT = ["src/components", "src/app/page.tsx"];

function git(args: string): string {
  return execSync(`git ${args}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/**
 * When the homepage's content last changed: the date of the last commit that
 * touched it, read at build time. Undefined when git history can't tell, so
 * the sitemap leaves lastmod out instead of claiming the build time. In a
 * shallow clone (Vercel's default), the oldest fetched commit looks like it
 * added every file, so a match on that boundary commit is not trusted either.
 */
function homepageLastModified(): string | undefined {
  try {
    const [hash, date] = git(`log -1 --format=%H%n%cI -- ${HOMEPAGE_CONTENT.join(" ")}`).split("\n");
    if (!hash || !date) return undefined;
    const shallowFile = git("rev-parse --git-path shallow");
    if (existsSync(shallowFile) && readFileSync(shallowFile, "utf8").split("\n").includes(hash)) return undefined;
    return date;
  } catch {
    return undefined;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = homepageLastModified();
  const posts = getAllPosts();
  return [
    { url: siteUrl(), ...(lastModified ? { lastModified } : {}) },
    { url: `${siteUrl()}/blog`, ...(posts[0] ? { lastModified: posts[0].lastModified } : {}) },
    { url: `${siteUrl()}/docs/mcp` },
    { url: `${siteUrl()}/privacy-policy` },
    { url: `${siteUrl()}/terms` },
    ...posts.map((post) => ({ url: `${siteUrl()}${post.path}`, lastModified: post.lastModified })),
  ];
}
