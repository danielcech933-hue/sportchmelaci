import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/ProfileView";
import { AccountSecurity } from "@/components/AccountSecurity";

export const Route = createFileRoute("/profile/")({
  head: () => ({
    meta: [
      { title: "Můj profil — Chmeloví Sportovci" },
      { name: "description", content: "Tvoje zápasy, sázky, statistiky a odznaky." },
      { property: "og:title", content: "Můj profil — Chmeloví Sportovci" },
      { property: "og:description", content: "Tvoje zápasy, sázky, statistiky a odznaky." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <>
      <ProfileView />
      <AccountSecurity />
    </>
  );
}
