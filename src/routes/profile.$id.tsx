import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/ProfileView";
import { PlayerLocator } from "@/components/PlayerLocator";
import { PublicPhoneActions } from "@/components/PublicPhoneActions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile/$id")({
  head: () => ({
    meta: [
      { title: "Profil hráče — Chmeloví Sportovci" },
      { name: "description", content: "Veřejný profil hráče: zápasy, sázky, statistiky a odznaky." },
      { property: "og:title", content: "Profil hráče — Chmeloví Sportovci" },
      { property: "og:description", content: "Veřejný profil hráče: zápasy, sázky, statistiky a odznaky." },
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
      {user && <PublicPhoneActions userId={id} isSelf={Boolean(isSelf)} />}
      {user && <LocatorWrapper userId={id} isSelf={Boolean(isSelf)} nickname={isSelf ? nickname : null} />}
    </>
  );
}

function LocatorWrapper({ userId, isSelf, nickname }: { userId: string; isSelf: boolean; nickname: string | null }) {
  return <PlayerLocator userId={userId} isSelf={isSelf} nickname={nickname} />;
}
