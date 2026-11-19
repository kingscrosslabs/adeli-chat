import type { Metadata } from "next";
import Link from "next/link";

import { COMPANY, LegalPage } from "@/components/legal-page";
import { APP_URL, CONTACT_EMAIL, GITHUB_URL } from "@/lib/links";

/**
 * /terms: the Terms of Service for the hosted LedaChat (app.ledachat.com, its
 * MCP server and this site). Self-hosted copies are covered by the MIT license
 * only. Change `UPDATED` whenever the substance changes.
 */

const TITLE = "Terms of Service";
const DESCRIPTION = "The terms for using the hosted LedaChat app, its MCP server and this website: your account, Instagram rules, acceptable use, plans and billing.";
const UPDATED = { iso: "2026-11-19", label: "November 19, 2026" };
const MAIL = `mailto:${CONTACT_EMAIL}`;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | LedaChat` },
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: { type: "article", url: "/terms", siteName: "LedaChat", title: TITLE, description: DESCRIPTION },
};

export default function Terms() {
  return (
    <LegalPage title={TITLE} path="/terms" updated={UPDATED}>
      <p>
        These terms are an agreement between you and {COMPANY.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) for using the hosted LedaChat app at{" "}
        <a href={APP_URL}>app.ledachat.com</a>, its MCP server and API, and this website (together, the &ldquo;Service&rdquo;). By using the
        Service you agree to them. If you use it for a business, you agree for that business and confirm you can.
      </p>

      <h2 id="service">1. The Service</h2>
      <p>
        LedaChat runs Instagram automations for you: when someone comments on your post or replies to your story, it can reply publicly and send
        them direct messages that you write. You can manage it in the app or from an AI agent connected to its MCP server.
      </p>
      <p>
        LedaChat&apos;s code is open source under the MIT license at <a href={GITHUB_URL}>GitHub</a>. That license governs the code. These terms
        govern the hosted Service we run. If you run your own copy, these terms don&apos;t apply to it.
      </p>

      <h2 id="accounts">2. Your account</h2>
      <ul>
        <li>You must be at least 18 and able to form a binding contract.</li>
        <li>You sign in with Google. Keep that account and any LedaChat API tokens secure; you are responsible for what happens under your account.</li>
        <li>Tell us at <a href={MAIL}>{CONTACT_EMAIL}</a> if you think someone else has access to it.</li>
      </ul>

      <h2 id="instagram">3. Your Instagram account</h2>
      <ul>
        <li>Connect only Instagram accounts you own or are authorized to manage.</li>
        <li>
          You must follow Instagram&apos;s and Meta&apos;s terms, community guidelines and platform policies, including their messaging rules. Meta
          decides what its APIs allow and may limit or change them at any time, which can change what LedaChat can do.
        </li>
        <li>Everything your automations send is sent from your Instagram account, as you set it up. You are responsible for it.</li>
      </ul>

      <h2 id="acceptable-use">4. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>send spam, or messages people didn&apos;t ask for by commenting or replying to you;</li>
        <li>send anything unlawful, deceptive, harassing, hateful, sexually explicit, or that infringes anyone&apos;s rights;</li>
        <li>link to malware, phishing or scams, or collect information under false pretenses;</li>
        <li>break Meta&apos;s rules or try to get around Instagram&apos;s limits;</li>
        <li>probe, overload or attack the Service, reach other users&apos; data, or resell the Service without our written permission.</li>
      </ul>
      <p>
        When your automations collect email addresses or other data from people, you are responsible for having a lawful basis for it, telling them
        how you will use it, and following the law that applies, such as anti-spam and data protection laws.
      </p>

      <h2 id="content">5. Your content</h2>
      <p>
        You keep all rights to what you put into LedaChat, such as automation text and links. You give us a license to store, process and send it
        only as needed to run the Service for you. You confirm you have the rights to it.
      </p>

      <h2 id="ai">6. AI agents</h2>
      <p>
        When you connect an AI agent, it acts for you: what it does through LedaChat, such as putting an automation live, counts as done by you.
        Connect only agents you trust, and review what an agent intends to do before it sends messages. Data a tool returns goes to the agent&apos;s
        provider under its own terms. We aren&apos;t responsible for what third-party agents do or produce.
      </p>

      <h2 id="billing">7. Plans and billing</h2>
      <ul>
        <li>The Free plan is free, with the limits shown in the app. Free automations add &ldquo;Powered by LedaChat&rdquo; after the final DM.</li>
        <li>Pro is a subscription billed in advance through Stripe. It renews automatically until you cancel. You can cancel at any time in the app, and keep Pro until the end of the period you paid for.</li>
        <li>Payments aren&apos;t refundable, except where the law requires.</li>
        <li>We may change prices or plans. We&apos;ll tell you before a price change applies to your subscription, and you can cancel before it does.</li>
      </ul>

      <h2 id="privacy">8. Privacy</h2>
      <p>
        Our <Link href="/privacy-policy">Privacy Policy</Link> explains what we collect and why. For data about the people your automations answer,
        we process it on your behalf to run the Service.
      </p>

      <h2 id="third-parties">9. Third-party services</h2>
      <p>
        The Service depends on others, including Meta, Adeli, Google and Stripe. We aren&apos;t responsible for their services, and an outage or
        change on their side can affect LedaChat.
      </p>

      <h2 id="availability">10. Availability and changes</h2>
      <p>
        We work to keep LedaChat running, but we don&apos;t guarantee that it will always be available, or that every comment will be answered or
        every message delivered. We may change, add or remove features.
      </p>

      <h2 id="disclaimers">11. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT, TO THE FULLEST EXTENT THE LAW ALLOWS.
      </p>

      <h2 id="liability">12. Limitation of liability</h2>
      <p>
        TO THE FULLEST EXTENT THE LAW ALLOWS, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR FOR LOST
        PROFITS, REVENUE, DATA OR GOODWILL, OR FOR ACTIONS META TAKES ON YOUR INSTAGRAM ACCOUNT. OUR TOTAL LIABILITY FOR ANY CLAIM ABOUT THE SERVICE
        IS LIMITED TO THE GREATER OF WHAT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM AND 100 US DOLLARS.
      </p>
      <p>These limits don&apos;t apply to liability that the law doesn&apos;t allow us to limit.</p>

      <h2 id="indemnity">13. Indemnity</h2>
      <p>
        You will defend and compensate us against claims by others arising from your content, the messages your automations send, the data you
        collect with them, or your breach of these terms or the law.
      </p>

      <h2 id="termination">14. Ending these terms</h2>
      <p>
        You can stop using LedaChat and delete your account at any time in Settings. We may suspend or end your access if you break these terms,
        if Meta requires it, or to protect the Service or others; where we reasonably can, we&apos;ll tell you first. Sections that by their nature
        should survive, such as 11 to 16, survive.
      </p>

      <h2 id="law">15. Governing law</h2>
      <p>
        These terms are governed by the laws of the State of New York, without regard to its conflict of law rules. Disputes go to the state and
        federal courts in New York County, New York, unless the law where you live gives you the right to bring them elsewhere.
      </p>

      <h2 id="general">16. General</h2>
      <p>
        We&apos;ll post changes to these terms here and update the date at the top; for significant changes we&apos;ll also tell signed-in users.
        Using the Service after a change means you accept it. These terms and the Privacy Policy are the whole agreement between us about the
        Service. If part of them can&apos;t be enforced, the rest still applies. Not enforcing a term isn&apos;t a waiver. You can&apos;t transfer
        these terms without our consent; we can, as part of a merger or sale of our business.
      </p>

      <h2 id="contact">17. Contact</h2>
      <p>
        {COMPANY.name}, {COMPANY.address}. Email <a href={MAIL}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
