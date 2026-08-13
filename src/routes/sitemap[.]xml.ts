import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/history", changefreq: "weekly", priority: "0.6" },
          { path: "/rankings", changefreq: "daily", priority: "0.8" },
          { path: "/schedule", changefreq: "daily", priority: "0.8" },
          { path: "/tournaments", changefreq: "daily", priority: "0.8" },
          { path: "/teams", changefreq: "weekly", priority: "0.7" },
          { path: "/venues", changefreq: "weekly", priority: "0.6" },
          { path: "/bets", changefreq: "daily", priority: "0.7" },
          { path: "/chat", changefreq: "daily", priority: "0.5" },
          { path: "/support", changefreq: "monthly", priority: "0.4" },
          { path: "/arcade", changefreq: "daily", priority: "0.6" },
          { path: "/ultimate-team", changefreq: "weekly", priority: "0.6" },
        ];
        const urls = entries.map((e) =>
          `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
        );
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
