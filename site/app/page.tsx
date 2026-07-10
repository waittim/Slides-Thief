import type { Metadata } from "next";
import { SlidesThiefApp } from "./SlidesThiefApp";

export const metadata: Metadata = {
  title: "Slides Thief · PPT捕手",
  description:
    "Slides Thief · PPT捕手 可以在浏览器本地把拍歪的演示文稿照片整理成干净 PDF。",
};

export default function Home() {
  return <SlidesThiefApp />;
}
