import type { Metadata } from "next";
import { Inter, Roboto_Slab } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/account/auth-provider";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://21games.ai"),
  title: {
    default: "21 Games (SOL GaMES) · Smart Games. Daily Rituals.",
    template: "%s · 21 Games",
  },
  description:
    "Daily gratitude, word-chain, and logic puzzle games by SOL Theory. Play Connect 5, 21 Things, 9 Rhymes, and daily brain puzzles.",
  applicationName: "21 Games (SOL GaMES)",
  authors: [{ name: "SOL Theory", url: "https://www.soltheory.com" }],
  generator: "Next.js",
  keywords: [
    "word games",
    "daily puzzle",
    "gratitude game",
    "word chain",
    "connect 5",
    "21 things",
    "9 rhymes",
    "NYT games alternative",
    "logic puzzles",
    "brain games",
  ],
  icons: {
    icon: [
      { url: assetPath("/favicon.svg"), type: "image/svg+xml" },
      { url: assetPath("/favicon.ico"), sizes: "any" },
    ],
    apple: [
      { url: assetPath("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" },
    ],
    shortcut: [assetPath("/favicon.svg")],
  },
  openGraph: {
    title: "21 Games (SOL GaMES) · Smart Games. Daily Rituals.",
    description:
      "Daily gratitude, word-chain, and logic puzzle games by SOL Theory. Play Connect 5, 21 Things, 9 Rhymes, and daily brain puzzles.",
    url: "https://21games.ai/",
    siteName: "21 Games (SOL GaMES)",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "21 Games (SOL GaMES) by SOL Theory",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "21 Games (SOL GaMES) · Smart Games. Daily Rituals.",
    description:
      "Daily gratitude, word-chain, and logic puzzle games by SOL Theory. Play Connect 5, 21 Things, 9 Rhymes, and daily brain puzzles.",
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
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
        <meta name="theme-color" content="#000000" />
        <link
          rel="icon"
          type="image/svg+xml"
          href={assetPath("/favicon.svg")}
        />
        <link
          rel="alternate icon"
          type="image/x-icon"
          href={assetPath("/favicon.ico")}
        />
        <link
          rel="apple-touch-icon"
          href={assetPath("/apple-touch-icon.png")}
        />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <div>{children}</div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
