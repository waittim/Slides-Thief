import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://www.zekun.blog/Slides-Thief/";
const title = "Slides Thief - Straighten Slide Photos into PDFs";
const description =
  "Straighten skewed photos of presentation slides and export them as a clean PDF locally in your browser. No upload required. Supports JPG, PNG, WebP, HEIC, and HEIF.";
const viewportContent = "width=device-width, initial-scale=1, viewport-fit=cover";
const viewportScript = `document.querySelector('meta[name="viewport"]')?.setAttribute("content", ${JSON.stringify(viewportContent)});`;

export const metadata: Metadata = {
  metadataBase: new URL("https://www.zekun.blog"),
  title,
  description,
  applicationName: "Slides Thief",
  creator: "Zekun",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Slides Thief",
    locale: "en_US",
    alternateLocale: ["zh_CN"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: viewportScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
