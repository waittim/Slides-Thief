import type { Metadata } from "next";
import { SlidesThiefApp } from "./SlidesThiefApp";

export const metadata: Metadata = {
  title: "Slides Thief Web",
  description:
    "Flatten photographed presentation slides into a clean PDF entirely in your browser.",
};

export default function Home() {
  return <SlidesThiefApp />;
}
