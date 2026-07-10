import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SlidesThiefApp } from "./SlidesThiefApp";
import "./globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Slides Thief mount point was not found.");
}

createRoot(root).render(
  <StrictMode>
    <SlidesThiefApp />
  </StrictMode>,
);
