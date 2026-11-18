import { faqPage, graph, jsonLdScript, organization, softwareApplication, website } from "@/lib/schema";
import { siteUrl } from "@/lib/site-url";

/**
 * Structured data for the landing page: who makes LedaChat, what it is, and the FAQ.
 * Only facts already on the page; no ratings, no Pro price. FAQ answers come from
 * the same `faqs` array the visible FAQ renders, so the two always match.
 */
export function JsonLd({ faqs }: { faqs: ReadonlyArray<{ question: string; text: string }> }) {
  const data = graph([
    organization(),
    website(),
    softwareApplication(),
    faqPage(faqs.map((faq) => ({ question: faq.question, answer: faq.text })), `${siteUrl()}/#faq`),
  ]);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
