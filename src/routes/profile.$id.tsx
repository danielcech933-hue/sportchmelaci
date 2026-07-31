import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/ProfileView";

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
  return <ProfileView userId={id} />;
}
