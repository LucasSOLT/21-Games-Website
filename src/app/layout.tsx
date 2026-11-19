import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Slab } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/account/auth-provider";
import { CssIntegrityGuard } from "@/components/css-integrity-guard";
import { assetPath } from "@/lib/asset-path";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const robotoSlab = Roboto_Slab({
  subsets: ["latin"],
  variable: "--font-roboto-slab",
  display: "swap",
});

const SITE_DESCRIPTION =
  "Play 9 original daily word, logic, and spatial puzzles in the 21 → 1 countdown by SOL Theory — 21 Things, 17 Syllables, 9 Rhymes, Eightfold Echo, 6 Pics, Connect 5, Four Score, Move Two, and 1 Win.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FCFCFD",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://21games.ai"),
  title: {
    default: "21 Games · Smart Games. Daily Rituals.",
    template: "%s · 21 Games",
  },
  description: SITE_DESCRIPTION,
  applicationName: "21 Games",
  manifest: assetPath("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    title: "21 Games",
    statusBarStyle: "default",
  },
  authors: [{ name: "SOL Theory", url: "https://www.soltheory.com" }],
  generator: "Next.js",
  keywords: [
    "21 Games",
    "daily puzzle",
    "word games",
    "logic puzzles",
    "21 Things",
    "17 Syllables",
    "9 Rhymes",
    "Eightfold Echo",
    "6 Pics",
    "Connect 5",
    "Four Score",
    "Move Two",
    "1 Win",
    "SOL Theory",
  ],
  icons: {
    icon: [
      { url: assetPath("/favicon.svg"), type: "image/svg+xml" },
      { url: assetPath("/favicon.ico"), sizes: "any" },
      { url: assetPath("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: assetPath("/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: assetPath("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" },
    ],
    shortcut: [assetPath("/favicon.ico")],
  },
  openGraph: {
    title: "21 Games · Smart Games. Daily Rituals.",
    description: SITE_DESCRIPTION,
    url: "https://21games.ai/",
    siteName: "21 Games",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "21 Games · 9 Daily Puzzles (21 → 1) by SOL Theory",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "21 Games · Smart Games. Daily Rituals.",
    description: SITE_DESCRIPTION,
    site: "@SOLTheory",
    creator: "@SOLTheory",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoSlab.variable}`}>
      <body className="font-body antialiased">
        <CssIntegrityGuard />
        <AuthProvider>
          <div>{children}</div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
