import type { Metadata } from "next";
import { headers } from "next/headers";
import { detectAcceptLanguageLocale } from "./i18n";
import "./globals.css";
import { GA_MEASUREMENT_ID } from "./lib/telemetry";
import { PRODUCT_METADATA } from "./product-metadata";

const siteUrl = PRODUCT_METADATA.website;
const title = PRODUCT_METADATA.title;
const description = PRODUCT_METADATA.description;
const viewportContent = "width=device-width, initial-scale=1, viewport-fit=cover";
const viewportScript = `document.querySelector('meta[name="viewport"]')?.setAttribute("content", ${JSON.stringify(viewportContent)});`;
const themeScript = `try{var p=JSON.parse(localStorage.getItem("slides_thief_user_preferences")||"{}");if(p.theme==="dark"||p.theme==="light"||p.theme==="auto"){document.documentElement.dataset.theme=p.theme;}}catch(e){}`;
const telemetryScript = `try{var p=JSON.parse(localStorage.getItem("slides_thief_user_preferences")||"{}");if(p.telemetry===false){window["ga-disable-${GA_MEASUREMENT_ID}"]=true;}}catch(e){}`;
 
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: PRODUCT_METADATA.name,
  creator: "Zekun",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: PRODUCT_METADATA.name,
    locale: "en_US",
    alternateLocale: ["zh_CN"],
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1024,
        height: 537,
        alt: `${PRODUCT_METADATA.name} - Turn photographed slides or documents into clean PDFs`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let lang = "en";
  try {
    const requestHeaders = await headers();
    lang = detectAcceptLanguageLocale(requestHeaders.get("accept-language"));
  } catch {
    lang = "en";
  }

  return (
    <html lang={lang}>
      <head>
        {/* Keep icon/manifest relative so local/dev origins stay same-origin with start_url. */}
        <link rel="icon" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#20211f" />
        {/* Agent discovery for crawlers that parse HTML (GitHub Pages has no custom Link headers). */}
        <link rel="describedby" href="/llms.txt" type="text/plain" title="LLM site index" />
        <link rel="service-doc" href="/llms-full.txt" type="text/plain" title="Full agent reference" />
        <link rel="sitemap" href="/sitemap.xml" type="application/xml" />
        <meta name="theme-color" content="#20211f" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={PRODUCT_METADATA.name} />
        {/* Google Analytics opt-out check before gtag loads */}
        <script dangerouslySetInnerHTML={{ __html: telemetryScript }} />
        {/* Google tag (gtag.js) */}
        {/* eslint-disable-next-line @next/next/next-script-for-ga */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              if (!window['ga-disable-${GA_MEASUREMENT_ID}']) {
                gtag('config', '${GA_MEASUREMENT_ID}');
              }
            `,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: viewportScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
