import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://ari-ribeiro-karaoke.pages.dev",
  build: { inlineStylesheets: "always" },
});
