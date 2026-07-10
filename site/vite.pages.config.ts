import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

function githubPagesBase() {
  if (process.env.GITHUB_PAGES_BASE) return process.env.GITHUB_PAGES_BASE;

  const repository = process.env.GITHUB_REPOSITORY || "waittim/Slides-Thief";
  const repoName = repository.split("/").at(-1) || "Slides-Thief";
  if (repoName.toLowerCase().endsWith(".github.io")) return "/";

  return `/${repoName}/`;
}

export default defineConfig({
  root: resolve(projectRoot, "pages"),
  base: githubPagesBase(),
  publicDir: resolve(projectRoot, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, "dist-pages"),
    emptyOutDir: true,
    sourcemap: true,
  },
});
