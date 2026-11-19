import type { Metadata } from "next";
import Link from "next/link";

import { COMPANY, LegalPage } from "@/components/legal-page";
import { APP_URL, CONTACT_EMAIL, GITHUB_URL } from "@/lib/links";

/**
 * /privacy-policy: what the hosted LedaChat (app.ledachat.com, its MCP server
 * and this site) collects and why. Keep it in step with what the app stores
 * (`apps/web/src/lib/db/schema.ts`), the services it uses, and
 * `docs/analytics.md`. Change `UPDATED` whenever the substance changes.
 */

const TITLE = "Privacy Policy";
const DESCRIPTION = "What LedaChat collects when you use it, including data from your Instagram account and the people who comment on it, and what you can do about it.";
const UPDATED = { iso: "2026-11-19", label: "November 19, 2026" };
const MAIL = `mailto:${CONTACT_EMAIL}`;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | LedaChat` },
  description: DESCRIPTION,
  alternates: { canonical: "/privacy-policy" },
  openGraph: { type: "article", url: "/privacy-policy", siteName: "LedaChat", title: TITLE, description: DESCRIPTION },
};

export default function PrivacyPolicy() {
  return (
    <LegalPage title={TITLE} path="/privacy-policy" updated={UPDATED}>
      <p>
        This policy explains what personal information {COMPANY.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects through LedaChat, why, and what
        you can do about it. It covers the hosted LedaChat app at <a href={APP_URL}>app.ledachat.com</a>, its MCP server and API, and this website
        (together, the &ldquo;Service&rdquo;).
      </p>
      <p>
        LedaChat is open source. If you run your own copy from <a href={GITHUB_URL}>our GitHub repository</a>, we receive nothing from it, and this
        policy doesn&apos;t apply to it: whoever runs that copy is responsible for its data.
      </p>

      <h2 id="who">1. Who this policy is about</h2>
      <ul>
        <li>
          <strong>LedaChat users.</strong> You sign in and connect an Instagram account to run automations. For your own account data, we are the
          controller.
        </li>
        <li>
          <strong>People who interact with a LedaChat user&apos;s Instagram account.</strong> When you comment on a post or reply to a story and an
          automation answers you, the account owner decides what happens with your data and is its controller. We process it for them to run their
          automations. You can ask them, or us at <a href={MAIL}>{CONTACT_EMAIL}</a>, to delete it (see section 9).
        </li>
        <li>
          <strong>Website visitors and waitlist sign-ups.</strong> We are the controller of what this website collects.
        </li>
      </ul>

      <h2 id="collect">2. What we collect</h2>
      <h3>From you, as a LedaChat user</h3>
      <ul>
        <li><strong>Account details</strong> from Google sign-in: your name, email address, profile picture and Google account id. We don&apos;t get your Google password or any other Google data.</li>
        <li><strong>Your Instagram connection:</strong> your Instagram handle, display name and account id, and the ids of the connection we keep with Adeli (section 4).</li>
        <li><strong>Automations:</strong> what you set up, including keywords, public replies, DM text, links, and the post or story each one runs on.</li>
        <li><strong>Billing</strong>, if you upgrade to Pro: your plan and subscription status. Stripe collects and holds your card details; we never see your full card number.</li>
        <li><strong>AI agent connections:</strong> the AI clients you authorize, what you allowed them to do, and your API tokens (stored hashed, with an encrypted copy so you can reveal your own token).</li>
        <li><strong>Messages you send us</strong> by email or through forms.</li>
      </ul>
      <h3>About the people your automations answer</h3>
      <p>To run an automation, we store, for each person who triggers it:</p>
      <ul>
        <li>their Instagram user id and username, and the text of the comment or story reply that triggered it;</li>
        <li>how far they got in the flow (opening DM sent, button tapped, follow check, final DM sent) and when;</li>
        <li>the email address they send, if the automation asks for one. You can see and export these leads in the app.</li>
      </ul>
      <p>We don&apos;t store the rest of your Instagram inbox. Messages that aren&apos;t part of an automation&apos;s flow are ignored.</p>
      <h3>Collected automatically</h3>
      <ul>
        <li><strong>Product analytics</strong> in the app (PostHog): pages viewed, buttons clicked and actions taken, keyed to your LedaChat user id. They never include the usernames, comments, messages or emails of the people your automations answer.</li>
        <li><strong>Website analytics</strong> through Google Tag Manager on this site and the app.</li>
        <li><strong>Logs:</strong> IP address, browser, the requests made and errors, kept to run the Service and investigate problems and abuse.</li>
        <li><strong>MCP and API calls:</strong> which tool was called, by which client, when, and whether it worked.</li>
      </ul>
      <h3>From the waitlist</h3>
      <p>If you join the waitlist, the form (run by Tally) collects what you enter, such as your email address and Instagram handle.</p>

      <h2 id="use">3. How we use it</h2>
      <ul>
        <li>To run the Service: sign you in, connect your Instagram account, run your automations, and show you their results.</li>
        <li>To bill you for Pro and enforce plan limits.</li>
        <li>To support you, fix problems, keep the Service secure and prevent abuse.</li>
        <li>To understand how LedaChat is used and improve it.</li>
        <li>To send you messages about your account and the Service. We don&apos;t send marketing email without your consent.</li>
      </ul>
      <p>
        Our legal bases, where the GDPR applies, are: performing our contract with you; our legitimate interests in running, securing and improving
        the Service; your consent, where we ask for it; and our legal obligations. When we process data about the people your automations answer,
        we do it on your behalf and you are responsible for having a basis for it.
      </p>
      <p>
        We don&apos;t sell personal information, we don&apos;t share it for cross-context behavioral advertising, and we don&apos;t use your data or
        your audience&apos;s data to train machine learning models.
      </p>

      <h2 id="instagram">4. Instagram and Meta</h2>
      <p>
        LedaChat connects to Instagram through the official Meta APIs, using <a href="https://www.tryadeli.com">Adeli</a>, an API also built by{" "}
        {COMPANY.name}. When you connect an account you log in with Instagram or Facebook and approve the permissions it asks for. Your Instagram
        access tokens are held by Adeli, not in LedaChat&apos;s database.
      </p>
      <p>With that access, LedaChat:</p>
      <ul>
        <li>reads your recent posts, reels and live stories, so you can pick what an automation runs on;</li>
        <li>receives new comments and story replies, and the messages people send in reply to your automations;</li>
        <li>posts public replies under comments and sends DMs, only as your automations are set up to;</li>
        <li>checks whether someone follows you, when an automation&apos;s follow check is on.</li>
      </ul>
      <p>
        We use Instagram data only to provide the Service to you, and handle it as Meta&apos;s Platform Terms require. You can disconnect your
        Instagram account at any time in the app&apos;s Settings, or remove LedaChat in Instagram under Settings, then Apps and websites.
      </p>

      <h2 id="ai">5. AI agents and the MCP server</h2>
      <p>
        You can connect an AI agent, such as Claude, ChatGPT, Codex or Cursor, to LedaChat&apos;s MCP server. It signs in through OAuth, where a
        consent screen shows what it may do and lets you choose read only, or with an API token you create.
      </p>
      <ul>
        <li>A connected agent reaches only your own LedaChat account and its Instagram account. It can do what the app can: read and change your automations, put them live, and see who engaged.</li>
        <li>What a tool returns, including commenters&apos; usernames and comments, goes to the company that runs the agent and is then handled under its own terms and privacy policy. We don&apos;t control that.</li>
        <li>You can disconnect any agent or revoke any token on the Connect to AI Agent page in the app.</li>
      </ul>

      <h2 id="sharing">6. Who we share it with</h2>
      <p>We share personal information only with the service providers that run LedaChat for us, under contracts that limit what they may do with it:</p>
      <table>
        <thead>
          <tr><th>Provider</th><th>What for</th></tr>
        </thead>
        <tbody>
          <tr><td>Adeli ({COMPANY.name})</td><td>Connecting to Instagram, sending replies and DMs, receiving comments and messages</td></tr>
          <tr><td>Meta Platforms</td><td>Instagram itself, which delivers your replies and DMs</td></tr>
          <tr><td>Vercel</td><td>Hosting the app and this website</td></tr>
          <tr><td>Neon</td><td>The database</td></tr>
          <tr><td>Google</td><td>Sign-in, and Google Tag Manager</td></tr>
          <tr><td>Stripe</td><td>Payments for Pro</td></tr>
          <tr><td>PostHog</td><td>Product analytics</td></tr>
          <tr><td>Tally</td><td>The waitlist form</td></tr>
          <tr><td>Slack</td><td>Internal alerts to our team about sign-ups and billing, which may name you but never the people your automations answer</td></tr>
        </tbody>
      </table>
      <p>
        We may also disclose information when the law requires it, to protect the rights and safety of our users or others, or as part of a merger or
        sale of our business, in which case this policy keeps applying to it.
      </p>

      <h2 id="retention">7. How long we keep it</h2>
      <ul>
        <li>Your account, automations, and their runs and leads are kept while your account exists.</li>
        <li>Reset runs on an automation deletes its runs. Deleting an automation deletes its runs and leads.</li>
        <li>Deleting your account in Settings deletes your account and everything LedaChat keeps for it. Disconnect Instagram and cancel Pro first.</li>
        <li>Billing records are kept as long as tax and accounting law requires. Logs and backups are deleted on a rolling basis.</li>
      </ul>

      <h2 id="security">8. Security</h2>
      <p>
        Data is encrypted in transit and at rest. API tokens are stored hashed, secrets are encrypted, and each user can reach only their own data.
        No system is perfectly secure; if a breach affects your personal information, we will tell you as the law requires.
      </p>

      <h2 id="rights">9. Your rights</h2>
      <p>
        Depending on where you live, including under the GDPR, the UK GDPR and California law, you may have the right to access, correct, delete or
        export your personal information, to object to or restrict how we use it, and to withdraw consent. We won&apos;t treat you differently for
        using these rights.
      </p>
      <p>
        You can see and change most of your data in the app, and delete your account in Settings. For anything else, email{" "}
        <a href={MAIL}>{CONTACT_EMAIL}</a>. We may need to confirm who you are first, and we answer within 30 days.
      </p>
      <p>
        <strong>If an automation messaged you</strong> and you want your data deleted, ask the Instagram account that messaged you, or email us with
        your Instagram username and the account that messaged you. You can also stop it at any time by not replying, or by blocking or restricting
        the account in Instagram. In the EU and UK you can complain to your data protection authority.
      </p>

      <h2 id="cookies">10. Cookies</h2>
      <p>
        The app uses cookies to keep you signed in. The app and this website use analytics cookies from PostHog and Google Tag Manager. You can
        block or delete cookies in your browser; the app needs its sign-in cookie to work.
      </p>

      <h2 id="children">11. Children</h2>
      <p>LedaChat is for businesses and creators, not for children. You must be at least 18 to create an account, and we don&apos;t knowingly collect data from children under 13.</p>

      <h2 id="transfers">12. International transfers</h2>
      <p>
        We are based in the United States and our providers mostly process data there. Where we transfer personal data from the EU, the UK or
        Switzerland, we rely on safeguards such as the European Commission&apos;s Standard Contractual Clauses.
      </p>

      <h2 id="changes">13. Changes</h2>
      <p>We&apos;ll post any change here and update the date at the top. For significant changes, we&apos;ll also tell signed-in users by email or in the app.</p>

      <h2 id="contact">14. Contact</h2>
      <p>
        {COMPANY.name}, {COMPANY.address}. Email <a href={MAIL}>{CONTACT_EMAIL}</a>. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
