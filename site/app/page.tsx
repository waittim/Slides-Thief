import type { Metadata } from "next";
import { ProductInfo } from "./ProductInfo";
import { SlidesThiefApp } from "./SlidesThiefApp";

const siteUrl = "https://www.zekun.blog/Slides-Thief/";
const title = "Slides Thief - Straighten Slide Photos into PDFs";
const description =
  "Straighten skewed photos of presentation slides and export them as a clean PDF locally in your browser. No upload required. Supports JPG, PNG, WebP, HEIC, and HEIF.";

export const metadata: Metadata = {
  title,
  description,
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${siteUrl}#software`,
  name: "Slides Thief",
  alternateName: ["PPT捕手", "Slide Photo Straightener", "Presentation Photo to PDF Tool"],
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description,
  codeRepository: "https://github.com/waittim/Slides-Thief",
  license: "https://opensource.org/license/mit",
  author: { "@type": "Person", name: "Zekun Wang", url: "https://github.com/waittim" },
  featureList: [
    "Automatic slide boundary detection",
    "Manual four-corner correction",
    "Perspective correction",
    "HEIC and HEIF support",
    "Local browser processing",
    "PDF generation",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SlidesThiefApp />
      <ProductInfo />
    </>
  );
}
