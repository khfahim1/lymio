import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lymio.app"),
  title: "Lymio — Automated Minecraft News, Mods & Premium Accounts",
  description: "Lymio is the ultimate Minecraft hub. Get real-time official news, explore the smart mods directory with Modrinth redirects, and claim free premium Minecraft accounts securely. Fast, responsive, and 100% community-focused.",
  keywords: [
    "Lymio",
    "Minecraft",
    "Minecraft News",
    "Minecraft Mods",
    "Free Minecraft Premium",
    "Modrinth",
    "CurseForge",
    "Minecraft Community",
    "Minecraft Bedrock",
    "Minecraft Java",
    "OptiFine",
    "Sodium",
    "Minecraft Update"
  ],
  authors: [{ name: "Lymio" }],
  icons: {
    icon: "/logo-lymio.png",
  },
  openGraph: {
    title: "Lymio — Ultimate Minecraft News, Mods & Premium Accounts",
    description: "Get live official news, trending Modrinth mods, and claim free premium accounts. Fully optimized for desktop and mobile.",
    url: "https://lymio.app",
    siteName: "Lymio",
    images: [
      {
        url: "/hero.png",
        width: 1200,
        height: 630,
        alt: "Lymio Minecraft Community Hub",
      }
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lymio — Ultimate Minecraft News, Mods & Premium Accounts",
    description: "Automated official news, smart mod directories, and free premium account vault.",
    images: ["/hero.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://lymio.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
