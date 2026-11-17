import { GITHUB_URL } from "@/lib/links";
import { siteUrl } from "@/lib/site-url";

/**
 * Structured data for the landing page: who makes LedaChat, what it is, and the FAQ.
 * Only facts already on the page; no ratings, no Pro price. FAQ answers come from
 * the same `faqs` array the visible FAQ renders, so the two always match.
 */
export function JsonLd({ faqs }: { faqs: ReadonlyArray<{ question: string; text: string }> }) {
  const site = siteUrl();
  const organizationId = `${site}/#organization`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "King's Cross Labs",
        url: "https://www.kingscrosslabs.com",
        logo: `${site}/icon.png`,
        sameAs: [GITHUB_URL],
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        name: "LedaChat",
        url: site,
        publisher: { "@id": organizationId },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${site}/#software`,
        name: "LedaChat",
        url: site,
        description: "Turn Instagram comments into DMs, for free. Comment-to-DM workflow, with an MCP. Free & open source.",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        license: "https://opensource.org/licenses/MIT",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organizationId },
      },
      {
        "@type": "FAQPage",
        "@id": `${site}/#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.text },
        })),
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />;
}
