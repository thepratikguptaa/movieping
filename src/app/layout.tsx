import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "MoviePing — Never miss a release",
  description:
    "Waitlist upcoming movies and get pinged the moment they release. Powered by TMDB.",
  manifest: "/manifest.webmanifest",
  // Favicon is provided by the app/icon.svg file convention — auto-registered.
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
