import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";

import { GoogleTag } from "@adeli-chat/ui/analytics/google-tag";

import { siteUrl } from "@/lib/site-url";

import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const TITLE = "LedaChat: Free, Open-Source ManyChat Alternative for Instagram";
/** The two lines Google shows under the title, and the share card text. 110 to 160 characters, only claims the page makes. */
const DESCRIPTION =
  "Free, open-source ManyChat alternative for Instagram. Turn comments into DMs, and run your automations from Claude or ChatGPT with the built-in MCP.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  // One URL for every tagged or shared copy (?utm_source=...) to credit.
  alternates: { canonical: "/" },
  // The image comes from opengraph-image.tsx; Next adds og:image and twitter:image for it.
  openGraph: { type: "website", url: "/", siteName: "LedaChat", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Satoshi for headings. Fontshare serves it (free for commercial use); it is not on Google Fonts. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@500,700&display=swap" />
      </head>
      <body className="min-h-full">
        {/* Same theme setup as the app, so a visitor's choice carries over (docs/design.md). */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange storageKey="ledachat-theme">
          {children}
        </ThemeProvider>
        {/* Tally's embed script: the "Join waitlist" buttons open the form as a popup with it (components/waitlist.tsx). */}
        <Script src="https://tally.so/widgets/embed.js" strategy="afterInteractive" />
        <GoogleTag />
      </body>
    </html>
  );
}
