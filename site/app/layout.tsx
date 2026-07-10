import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slides Thief Web",
  description:
    "Flatten photographed presentation slides into a clean PDF entirely in your browser.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
