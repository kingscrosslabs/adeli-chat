import Link from "next/link";

import { Wordmark } from "@adeli-chat/ui/brand/wordmark";
import { ThemeToggle } from "@adeli-chat/ui/theme-toggle";

import { ADELI_LINKS } from "@/lib/links";

import { JoinWaitlist } from "./waitlist";

export { JoinWaitlist };

/**
 * The header, footer and waitlist button every page shares: the homepage and
 * the blog. Header links point at homepage sections with `/#section`, so they
 * work from a blog post too and scroll in place on the homepage.
 */

/** Leda Pink as a pen, not a fill (docs/design.md): title underlines, outlines, hover underlines and borders. */
export const TITLE_UNDERLINE = "underline decoration-highlight decoration-4 underline-offset-8 [text-decoration-skip-ink:none]";
export const HOVER_UNDERLINE = "underline-offset-4 decoration-highlight decoration-2 hover:underline";
export const HOVER_BORDER = "transition-colors hover:border-highlight";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why", label: "Why we built it" },
  { href: "/#mcp", label: "MCP" },
  { href: "/#options", label: "Options" },
  { href: "/blog", label: "Blog" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="LedaChat home"><Wordmark size="sm" /></Link>
        <nav aria-label="Sections" className="hidden flex-1 items-center gap-5 text-sm text-foreground md:flex">
          {NAV_LINKS.map((link) => <Link key={link.href} href={link.href} className={HOVER_UNDERLINE}>{link.label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <JoinWaitlist size="default" />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-4 text-sm text-foreground">
        <a href={ADELI_LINKS.footer} target="_blank" rel="noreferrer" className={HOVER_UNDERLINE}>Powered by Adeli</a>
        <Link href="/blog" className={HOVER_UNDERLINE}>Blog</Link>
        <Link href="/docs/mcp" className={HOVER_UNDERLINE}>MCP docs</Link>
        <Link href="/privacy-policy" className={HOVER_UNDERLINE}>Privacy</Link>
        <Link href="/terms" className={HOVER_UNDERLINE}>Terms</Link>
        <span>© King&apos;s Cross Labs</span>
        <ThemeToggle className="ml-auto" compact />
      </div>
    </footer>
  );
}
