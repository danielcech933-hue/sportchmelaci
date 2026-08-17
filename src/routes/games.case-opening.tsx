import { createFileRoute } from "@tanstack/react-router";
import { CaseOpeningLobby } from "@/components/case-opening/CaseOpeningLobby";

export const Route = createFileRoute("/games/case-opening")({
  head: () => ({
    meta: [
      { title: "Case Opening — SportChmeláci" },
      { name: "description", content: "Privátní case-opening lobby za betting dolary s virtuálními share collectibles, rarity a serverovou RNG." },
    ],
  }),
  component: CaseOpeningLobby,
});
