import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";

import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { absolute: "Adeli Chat: Free, Open-Source ManyChat Alternative for Instagram" },
  description: "Comment-to-DM workflow, with an MCP. Free & open source.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        {/* Same theme setup as the app, so a visitor's choice carries over (docs/brand.md). */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange storageKey="adeli-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
