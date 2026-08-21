import type { Metadata } from "next";
import { ProductInfo } from "./ProductInfo";
import { SlidesThiefApp } from "./SlidesThiefApp";
import { PRODUCT_METADATA } from "./product-metadata";

const siteUrl = PRODUCT_METADATA.website;
const title = PRODUCT_METADATA.title;
const description = PRODUCT_METADATA.description;

export const metadata: Metadata = {
  title,
  description,
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${siteUrl}#software`,
  name: PRODUCT_METADATA.name,
  alternateName: PRODUCT_METADATA.alternate_names,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description,
  codeRepository: PRODUCT_METADATA.repository,
  license: "https://opensource.org/license/mit",
  author: { "@type": "Person", name: "Zekun Wang", url: "https://github.com/waittim" },
  featureList: [
    "Automatic slide and document boundary detection",
    "16:9 default source format with explicit alternatives",
    "A3, A4, and Letter PDF paper output in landscape and portrait",
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
