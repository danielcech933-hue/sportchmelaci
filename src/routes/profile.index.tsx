import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/ProfileView";
import { ProfileAchievements } from "@/components/ProfileAchievements";
import { AccountSecurity } from "@/components/AccountSecurity";
import { ProfileIdentity2 } from "@/components/ProfileIdentity2";
import { useAuth } from "@/lib/auth";

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
  const { user } = useAuth();
  const userId = user?.id;

  return (
    <>
      <ProfileView />
      <div className="mx-auto max-w-6xl px-3 sm:px-4">
        {userId ? <ProfileIdentity2 userId={userId} /> : null}
        {userId ? <ProfileAchievements userId={userId} /> : null}
        <AccountSecurity />
      </div>
    </>
  );
}
