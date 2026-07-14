import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://slidesthief.com/";
const title = "Slides Thief - Straighten Slide Photos into PDFs";
const description =
  "Straighten skewed photos of presentation slides and export them as a clean PDF locally in your browser. No upload required. Supports JPG, PNG, WebP, HEIC, and HEIF.";
const viewportContent = "width=device-width, initial-scale=1, viewport-fit=cover";
const viewportScript = `document.querySelector('meta[name="viewport"]')?.setAttribute("content", ${JSON.stringify(viewportContent)});`;
 
export const metadata: Metadata = {
  metadataBase: new URL("https://slidesthief.com"),
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Keep icon/manifest relative so local/dev origins stay same-origin with start_url. */}
        <link rel="icon" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#20211f" />
        <meta name="theme-color" content="#20211f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Slides Thief" />
        {/* Google tag (gtag.js) */}
        {/* eslint-disable-next-line @next/next/next-script-for-ga */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-74RGGMV3PH" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-74RGGMV3PH');
            `,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: viewportScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
