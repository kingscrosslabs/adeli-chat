/** Pure helpers shared by the loader and the validator. No fs, no imports. */

export const BLOG_BASE_PATH = "/blog";

export function postPath(slug: string): string {
  return `${BLOG_BASE_PATH}/${slug}`;
}

/** Strip fenced code so word counts and heading scans ignore it. */
export function stripCode(markdown: string): string {
  return markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, "");
}

export function countWords(markdown: string): number {
  return stripCode(markdown).split(/\s+/).filter(Boolean).length;
}

/** `2026-09-22` -> `Sep 22, 2026`. Pinned to UTC so the day never shifts. */
export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
