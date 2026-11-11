import { ArrowRight, AtSign, BarChart3, Bot, Check, ChevronDown, CirclePause, Download, FileCode2, KeyRound, Link2, Mail, MessageCircle, MessageSquareReply, MessagesSquare, MousePointerClick, Repeat2, Server, ShieldCheck, Shuffle, Smartphone, UserCheck, X } from "lucide-react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { AiFillOpenAI } from "react-icons/ai";
import { SiClaude, SiGithub, SiPerplexity } from "react-icons/si";

import { CursorLogo } from "@adeli-chat/ui/brand/cursor-logo";
import { Wordmark } from "@adeli-chat/ui/brand/wordmark";
import { ThemeToggle } from "@adeli-chat/ui/theme-toggle";
import { Badge } from "@adeli-chat/ui/components/badge";
import { buttonVariants } from "@adeli-chat/ui/components/button";
import { ADELI_URL, GITHUB_URL, SIGN_IN_URL } from "@/lib/links";
import { cn } from "@adeli-chat/ui/lib/utils";

import { HeroPreview } from "./hero-preview";

/** Free plan size, shown in the hero, Options and FAQ. One place to change it. */
const FREE_AUTOMATIONS = 2;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <OfficialStrip />
        <HowItWorks />
        <AskClaude />
        <Features />
        <Comparison />
        <Options />
        <OfficialApi />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-16 border-t px-4 py-16 sm:px-6 md:py-20", className)}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

function SectionHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-10 max-w-2xl">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      {lead ? <p className="mt-3 text-base text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

function StartFree({ size = "lg", variant = "default", className }: { size?: "default" | "lg"; variant?: "default" | "outline"; className?: string }) {
  return (
    <a href={SIGN_IN_URL} className={cn(buttonVariants({ size, variant }), className)}>
      Start free <ArrowRight data-icon="inline-end" />
    </a>
  );
}

function GitHubButton({ className }: { className?: string }) {
  return (
    <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "lg" }), className)}>
      <SiGithub data-icon="inline-start" /> View on GitHub
    </a>
  );
}

function Header() {
  const links = [
    { href: "#how-it-works", label: "How it works" },
    { href: "#mcp", label: "MCP" },
    { href: "#options", label: "Options" },
    { href: "#faq", label: "FAQ" },
  ];
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Adeli Chat home"><Wordmark size="sm" /></Link>
        <nav aria-label="Sections" className="hidden flex-1 items-center gap-5 text-sm text-muted-foreground md:flex">
          {links.map((link) => <a key={link.href} href={link.href} className="hover:text-foreground">{link.label}</a>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a href={SIGN_IN_URL} className={buttonVariants({ variant: "ghost" })}>Sign in</a>
          <StartFree size="default" />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-4 pt-14 pb-16 sm:px-6 md:pt-20">
      <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1.1fr_1fr]">
        <div>
          <Badge variant="secondary" className="mb-5">Free and open source</Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">Turn Instagram comments into DMs, for free</h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Comment-to-DM workflow, with an MCP. Free &amp; open source.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <StartFree />
            <GitHubButton />
          </div>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

function OfficialStrip() {
  return (
    <div className="border-t bg-muted px-4 py-4 sm:px-6">
      <p className="mx-auto flex max-w-5xl items-center gap-2.5 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-link" aria-hidden />
        <span>Runs on Instagram&apos;s official API through Adeli, a Meta Tech Provider. No passwords, no scraping, no browser bots.</span>
      </p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Someone comments your keyword", body: "On a post, a reel, or whatever you publish next. Story replies work too." },
    { title: "Adeli Chat replies and sends a DM", body: "A public reply goes under their comment, and a DM with a button lands in their inbox." },
    { title: "They tap and get your link", body: "Want the lead? Ask for their email before the link goes out." },
  ];
  return (
    <Section id="how-it-works">
      <SectionHeading title="How it works" />
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-xl border bg-card p-5">
            <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-sm font-semibold text-secondary-foreground">{index + 1}</span>
            <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const ASSISTANTS: Array<{ name: string; icon: IconType | typeof CursorLogo; tile: string }> = [
  { name: "Claude", icon: SiClaude, tile: "#D97757" },
  { name: "ChatGPT", icon: AiFillOpenAI, tile: "#0F0F0F" },
  { name: "Cursor", icon: CursorLogo, tile: "#141414" },
  { name: "Perplexity", icon: SiPerplexity, tile: "#1F7A8C" },
];

const CONVERSATION: Array<{ from: "you" | "claude"; text: string }> = [
  { from: "you", text: "Set up a comment to DM on my latest reel. When someone comments GUIDE, send them my AI guide link." },
  { from: "claude", text: "Done. \"AI guide\" is ready on your latest reel, with the keyword GUIDE, a public reply and a DM with your link. Should I put it live?" },
  { from: "you", text: "Yes. And pause the one on last week's carousel." },
  { from: "claude", text: "\"AI guide\" is live and the carousel automation is paused." },
];

function AskClaude() {
  return (
    <Section id="mcp" className="bg-muted">
      <div className="grid items-start gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ask your favorite AI agent to set up your automation for you</h2>
          <ul className="mt-6 flex flex-wrap gap-3" aria-label="Works with">
            {ASSISTANTS.map(({ name, icon: Icon, tile }) => (
              <li key={name} className="flex items-center gap-2 rounded-lg border bg-card py-1.5 pr-3 pl-1.5 text-sm font-medium">
                <span className="flex size-6 items-center justify-center rounded-md text-white" style={{ backgroundColor: tile }}><Icon className="size-3.5" /></span>
                {name}
              </li>
            ))}
          </ul>
        </div>
        <figure className="rounded-xl border bg-card">
          <figcaption className="flex items-center gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground">
            <MessagesSquare className="size-3.5" aria-hidden /> Example conversation in Claude
          </figcaption>
          <div className="space-y-3 p-4">
            {CONVERSATION.map((message, index) => (
              <div key={index} className={cn("flex", message.from === "you" ? "justify-end" : "justify-start")}>
                <p className={cn("max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm", message.from === "you" ? "bg-secondary text-secondary-foreground" : "border bg-background")}>{message.text}</p>
              </div>
            ))}
          </div>
        </figure>
      </div>
    </Section>
  );
}

const FEATURES = [
  { icon: AtSign, title: "Keyword triggers" },
  { icon: MessageCircle, title: "Any-comment triggers" },
  { icon: Repeat2, title: "One post, next post or every post" },
  { icon: MessagesSquare, title: "Story replies" },
  { icon: MessageSquareReply, title: "Public comment replies" },
  { icon: Shuffle, title: "Random reply variations" },
  { icon: MousePointerClick, title: "DMs with a button" },
  { icon: Link2, title: "Link delivery" },
  { icon: Mail, title: "Email capture" },
  { icon: Download, title: "Lead export to CSV" },
  { icon: Smartphone, title: "Live phone preview" },
  { icon: UserCheck, title: "Once per person" },
  { icon: BarChart3, title: "Stats and tap tracking" },
  { icon: CirclePause, title: "Draft, live and pause" },
  { icon: Bot, title: "MCP for Claude, ChatGPT and Cursor" },
  { icon: KeyRound, title: "Read-only and expiring API tokens" },
  { icon: FileCode2, title: "Open source (MIT)" },
  { icon: Server, title: "Self-host on Vercel" },
];

function Features() {
  return (
    <Section id="features">
      <SectionHeading title="Everything a comment to DM needs" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title }) => (
          <li key={title} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-sm font-medium">
            <Icon className="size-4 shrink-0 text-link" aria-hidden />
            {title}
          </li>
        ))}
      </ul>
    </Section>
  );
}

type Cell = true | false | string;

const COMPARISON: Array<{ label: string; adeli: Cell; manychat: Cell }> = [
  { label: "Price", adeli: `Free for ${FREE_AUTOMATIONS} automations, then $25/month`, manychat: "Pro from $39/month, or $29/month billed yearly" },
  { label: "Graduated pricing", adeli: "No. One flat price whether 50 or 50,000 people comment", manychat: "Yes. The price rises with your active contacts" },
  { label: "Open source", adeli: true, manychat: false },
  { label: "Self-host", adeli: true, manychat: false },
  { label: "Built-in MCP for Claude and ChatGPT", adeli: true, manychat: false },
  { label: "Comment to DM on Instagram", adeli: true, manychat: true },
  { label: "Story replies", adeli: true, manychat: true },
  { label: "Email capture", adeli: true, manychat: true },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check className="size-4 text-link" aria-label="Yes" />;
  if (value === false) return <X className="size-4 text-destructive" aria-label="No" />;
  return <span>{value}</span>;
}

function Comparison() {
  return (
    <Section id="compare">
      <SectionHeading title="Adeli Chat vs ManyChat" />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="w-1/3 px-4 py-3 font-medium text-muted-foreground"><span className="sr-only">Feature</span></th>
              <th scope="col" className="px-4 py-3 font-semibold">Adeli Chat</th>
              <th scope="col" className="px-4 py-3 font-semibold">ManyChat</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.label} className="border-t">
                <th scope="row" className="px-4 py-3 font-medium">{row.label}</th>
                <td className="bg-secondary/40 px-4 py-3"><CellValue value={row.adeli} /></td>
                <td className="px-4 py-3 text-muted-foreground"><CellValue value={row.manychat} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Options() {
  const options = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      points: [`${FREE_AUTOMATIONS} live automations`, "MCP, email capture, story replies and stats", "\"Powered by Adeli\" in the last DM"],
      action: <StartFree size="lg" className="w-full" />,
      featured: true,
    },
    {
      name: "Pro",
      price: "$25",
      period: "per month",
      points: ["Unlimited live automations", "Everything in Free", "Remove \"Powered by Adeli\""],
      action: <StartFree variant="outline" className="w-full" />,
      featured: false,
    },
    {
      name: "Self-host",
      price: "Free",
      period: "MIT license",
      points: ["Unlimited automations", "Deploy to Vercel in a few steps", "Bring your Adeli API key. Adeli's free plan covers your own account"],
      action: <GitHubButton className="w-full" />,
      featured: false,
    },
  ];
  return (
    <Section id="options">
      <SectionHeading title="Options" lead="Use the hosted version, or run your own copy." />
      <div className="grid gap-4 md:grid-cols-3">
        {options.map((option) => (
          <div key={option.name} className={cn("flex flex-col rounded-xl border bg-card p-5", option.featured && "ring-2 ring-primary")}>
            <h3 className="text-base font-semibold">{option.name}</h3>
            <p className="mt-3"><span className="text-3xl font-semibold tracking-tight">{option.price}</span> <span className="text-sm text-muted-foreground">{option.period}</span></p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm">
              {option.points.map((point) => <li key={point} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-link" aria-hidden />{point}</li>)}
            </ul>
            <div className="mt-6">{option.action}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Pro is billed monthly. Cancel anytime.</p>
    </Section>
  );
}

function OfficialApi() {
  return (
    <Section id="official" className="bg-muted">
      <div className="grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Built on Instagram&apos;s official API</h2>
          <p className="mt-3 text-base text-muted-foreground">
            Adeli Chat connects through Adeli, a Meta Tech Provider. You log in with Instagram, and we never see your password.
          </p>
        </div>
        <a href={ADELI_URL} target="_blank" rel="noreferrer" className="group rounded-xl border bg-card p-5 transition hover:border-link">
          <span className="text-xs font-medium text-muted-foreground">Powered by</span>
          <span className="mt-2 flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/adeli-logo.png" alt="" className="size-7 rounded-md" />
            <span className="text-lg font-semibold tracking-tight">Adeli</span>
          </span>
          <p className="mt-3 text-sm text-muted-foreground">Building features like this for your own customers? Adeli Chat runs on the Adeli API.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-link">See the Adeli API <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
        </a>
      </div>
    </Section>
  );
}

function Faq() {
  const items = [
    { q: "Is this allowed by Instagram?", a: "Yes. Adeli Chat uses Instagram's official API through Adeli, a Meta Tech Provider, and only messages people who commented or replied to your story first." },
    { q: "What account do I need?", a: "An Instagram professional account (Business or Creator). Switching is free in Instagram's settings." },
    { q: "Do I need an Adeli account?", a: "Not for the hosted version. To self-host, you need an Adeli API key, and Adeli's free plan covers your own account." },
    { q: "What happens at the free limit?", a: `Your ${FREE_AUTOMATIONS} automations stay live. Pause one to start another, or go Pro for unlimited.` },
    { q: "Does it work on Facebook or TikTok?", a: "No, Instagram only." },
    { q: "Can I cancel Pro?", a: "Yes. It's monthly, and you can cancel anytime." },
  ];
  return (
    <Section id="faq">
      <SectionHeading title="FAQ" />
      <div className="divide-y rounded-xl border bg-card">
        {items.map((item) => (
          <details key={item.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-2.5 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <Section className="text-center">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Your next comment could be a lead</h2>
      <p className="mt-3 text-base text-muted-foreground">Set up your first automation in a few minutes. Free for {FREE_AUTOMATIONS} automations.</p>
      <div className="mt-7 flex justify-center"><StartFree /></div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-4 text-sm text-muted-foreground">
        <a href={ADELI_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">Powered by Adeli</a>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
        <a href={SIGN_IN_URL} className="hover:text-foreground">Sign in</a>
        <span>© King&apos;s Cross Labs</span>
        <ThemeToggle className="ml-auto" compact />
      </div>
    </footer>
  );
}
