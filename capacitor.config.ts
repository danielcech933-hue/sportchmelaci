import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.chmelovi_sportovci",
  appName: "Chmeloví Sportovci",
  webDir: "dist/client",
  server: {
    // Hot-reload from the Lovable preview during development.
    // Remove `url` before building a production/App Store build.
    url: "https://80abc07b-076c-4b03-9705-d987f6d43540.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    backgroundColor: "#0a0a12",
  },
};

export default config;
