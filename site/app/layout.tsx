import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slides Thief · PPT捕手",
  description:
    "Slides Thief · PPT捕手 可以在浏览器本地把拍歪的演示文稿照片整理成干净 PDF。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
