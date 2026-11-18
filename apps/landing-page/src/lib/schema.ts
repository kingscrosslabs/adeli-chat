import { GITHUB_URL } from "@/lib/links";
import { siteUrl } from "@/lib/site-url";

/**
 * The site-wide JSON-LD nodes, by stable `@id`, so the homepage and every
 * blog post reference one Organization, WebSite and SoftwareApplication
 * instead of redefining them. Only facts the site states; no ratings.
 */

export type JsonLdNode = Record<string, unknown>;

export const organizationId = () => `${siteUrl()}/#organization`;
export const websiteId = () => `${siteUrl()}/#website`;
export const softwareId = () => `${siteUrl()}/#software`;

export function organization(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: "King's Cross Labs",
    url: "https://www.kingscrosslabs.com",
    logo: `${siteUrl()}/icon.png`,
    sameAs: [GITHUB_URL],
  };
}

export function website(): JsonLdNode {
  return { "@type": "WebSite", "@id": websiteId(), name: "LedaChat", url: siteUrl(), publisher: { "@id": organizationId() } };
}

export function softwareApplication(): JsonLdNode {
  return {
    "@type": "SoftwareApplication",
    "@id": softwareId(),
    name: "LedaChat",
    url: siteUrl(),
    description: "Turn Instagram comments into DMs, for free. Comment-to-DM workflow, with an MCP. Free & open source.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    license: "https://opensource.org/licenses/MIT",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": organizationId() },
  };
}

export function faqPage(faqs: ReadonlyArray<{ question: string; answer: string }>, id: string): JsonLdNode {
  return {
    "@type": "FAQPage",
    "@id": id,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function breadcrumbs(items: ReadonlyArray<{ name: string; path: string }>): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, siteUrl()).href,
    })),
  };
}

export function graph(nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** A `<script type="application/ld+json">` body, with `<` escaped so content can't close the tag. */
export function jsonLdScript(data: JsonLdNode): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
