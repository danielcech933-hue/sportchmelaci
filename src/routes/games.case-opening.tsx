import { createFileRoute } from "@tanstack/react-router";
import { CaseOpeningLobby } from "@/components/case-opening/CaseOpeningLobby";

export const Route = createFileRoute("/games/case-opening")({
  head: () => ({
    meta: [
      { title: "Case Opening — SportChmeláci" },
      { name: "description", content: "Privátní case-opening lobby se serverovou RNG a Slot CZK odměnami." },
    ],
  }),
  component: CaseOpeningLobby,
});
