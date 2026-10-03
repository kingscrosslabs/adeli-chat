import type { Metadata } from "next";
import { Geist_Mono, Inter, Jersey_10 } from "next/font/google";

import { DemoControls } from "@/components/demo/demo-controls";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jersey = Jersey_10({ variable: "--font-jersey", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Adeli Chat", template: "%s · Adeli Chat" },
  description: "Open-source Instagram Comment to DM automations, built on the Adeli API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} ${jersey.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>
          {children}
          <DemoControls />
          <Toaster position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
