import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/ProfileView";
import { ProfileAchievements } from "@/components/ProfileAchievements";
import { ProfileMediaGallery } from "@/components/ProfileMediaGallery";
import { SocialHub } from "@/components/SocialHub";
import { PlayerLocator } from "@/components/PlayerLocator";
import { PublicPhoneActions } from "@/components/PublicPhoneActions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile/$id")({
  head: () => ({
    meta: [
      { title: "Profil hráče — Chmeloví Sportovci" },
      { name: "description", content: "Veřejný profil hráče: zápasy, sázky, statistiky, odznaky, fotky a příspěvky." },
      { property: "og:title", content: "Profil hráče — Chmeloví Sportovci" },
      { property: "og:description", content: "Veřejný profil hráče: zápasy, sázky, statistiky, odznaky, fotky a příspěvky." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();
  const { user, nickname } = useAuth();
  const isSelf = user?.id === id;
  return (
    <>
      <ProfileView userId={id} />
      <div className="mx-auto max-w-6xl px-3 sm:px-4">
        <ProfileAchievements userId={id} />
        <ProfileMediaGallery userId={id} />
        <div className="mt-5"><SocialHub profileUserId={id} /></div>
      </div>
      {user && <PublicPhoneActions userId={id} isSelf={Boolean(isSelf)} />}
      {user && <LocatorWrapper userId={id} isSelf={Boolean(isSelf)} nickname={isSelf ? nickname : null} />}
    </>
  );
}

function LocatorWrapper({ userId, isSelf, nickname }: { userId: string; isSelf: boolean; nickname: string | null }) {
  return <PlayerLocator userId={userId} isSelf={isSelf} nickname={nickname} />;
}
