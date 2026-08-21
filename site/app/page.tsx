import type { Metadata } from "next";
import { ProductInfo } from "./ProductInfo";
import { SlidesThiefApp } from "./SlidesThiefApp";
import { PRODUCT_METADATA } from "./product-metadata";

const siteUrl = PRODUCT_METADATA.website;
const title = PRODUCT_METADATA.title;
const description = PRODUCT_METADATA.description;
const webSourceFormats = PRODUCT_METADATA.ratios.web_source_base_formats.filter((item) => item.kind !== "custom");
const webPresentationDefault = webSourceFormats[0] && "label" in webSourceFormats[0]
  ? webSourceFormats[0].label
  : webSourceFormats[0]?.id ?? "16:9";
const webPaperFamilies = [...new Set(PRODUCT_METADATA.ratios.paper.filter((item) => item.web).map((item) => item.family))];
const heicInput = PRODUCT_METADATA.input_formats.find((item) => item.id === "heic-heif")?.label ?? "HEIC / HEIF";

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
    `${webPresentationDefault} default source format with explicit alternatives`,
    `${webPaperFamilies.join(", ")} PDF paper output in landscape and portrait`,
    "Manual four-corner correction",
    "Perspective correction",
    `${heicInput} support`,
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
