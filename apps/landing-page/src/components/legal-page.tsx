import type { ReactNode } from "react";

import { cn } from "@adeli-chat/ui/lib/utils";

import { SiteFooter, SiteHeader, TITLE_UNDERLINE } from "@/components/site-chrome";
import { CONTACT_EMAIL } from "@/lib/links";
import { breadcrumbs, graph, jsonLdScript, organization, website } from "@/lib/schema";

/**
 * The Privacy Policy and Terms pages: the site chrome, a title band with the
 * effective date and who runs LedaChat, then long-form text in `blog-prose`.
 * The Claude plugin (`plugins/ledachat/.claude-plugin/plugin.json`), the MCP
 * Registry and the AI directories link to these URLs, so keep the paths.
 */

/** Who runs the hosted LedaChat. Shown on both legal pages. */
export const COMPANY = {
  name: "King's Cross Labs, Inc.",
  address: "175 West 90th Street, New York, NY 10024, United States",
};

export function LegalPage({ title, path, updated, children }: { title: string; path: string; updated: { iso: string; label: string }; children: ReactNode }) {
  const structuredData = graph([
    organization(),
    website(),
    breadcrumbs([
      { name: "LedaChat", path: "/" },
      { name: title, path },
    ]),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData) }} />
      <SiteHeader />
      <main>
        <header className="bg-muted px-4 pt-12 pb-10 sm:px-6 md:pt-16">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <h1 className={cn("text-3xl font-semibold tracking-tight text-balance md:text-4xl", TITLE_UNDERLINE)}>{title}</h1>
            <p className="text-sm">
              Effective <time dateTime={updated.iso}>{updated.label}</time>. LedaChat is run by {COMPANY.name}, {COMPANY.address}.{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">{CONTACT_EMAIL}</a>
            </p>
          </div>
        </header>
        <div className="px-4 pt-10 pb-16 sm:px-6">
          <article className="blog-prose mx-auto max-w-2xl">{children}</article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
