import { createFileRoute, Navigate } from "@tanstack/react-router";
import { CaseOpeningLobby } from "@/components/case-opening/CaseOpeningLobby";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/games/case-opening")({
  head: () => ({ meta: [{ title: "Case Opening — SportChmeláci" }, { name: "description", content: "Privátní case-opening lobby za betting dolary s virtuálními share collectibles, rarity a serverovou RNG." }] }),
  component: CaseOpeningGate,
});

function CaseOpeningGate() {
  const { user, nickname, loading } = useAuth();
  if (loading) return null;
  if ((nickname ?? "").trim().toLocaleLowerCase("cs-CZ") === "boro nezastavitelny") return <Navigate to="/" replace />;
  if (!user) return <Navigate to="/auth" replace />;
  return <CaseOpeningLobby />;
}
