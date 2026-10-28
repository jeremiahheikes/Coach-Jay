import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Coach Jay", template: "%s · Coach Jay" },
  description: "Golf coaching: progress, ball data, swing video and lessons.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Coach Jay" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f4ee" }, { media: "(prefers-color-scheme: dark)", color: "#111614" }],
  viewportFit: "cover",
};

import { RegisterSW } from "@/components/RegisterSW";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- root layout applies to every page */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" />
      </head>
      <body className="min-h-full flex flex-col"><RegisterSW />{children}</body>
    </html>
  );
}
