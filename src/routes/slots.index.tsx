import { createFileRoute } from "@tanstack/react-router";
import { SlotLobby } from "@/components/slots/SlotLobby";

export const Route = createFileRoute("/slots/")({
  head: () => ({
    meta: [
      { title: "Sloty — herní lobby Chmelových Sportovců" },
      {
        name: "description",
        content:
          "Herní lobby se slotem Chmelovci Cup a směnárnou kreditů. Kurz 1 dolar = 100 Slot CZK, hraje se pouze o zábavní kredity.",
      },
      { property: "og:title", content: "Sloty — herní lobby Chmelových Sportovců" },
      {
        property: "og:description",
        content: "Vyber si hru, směň kredity ve směnárně a roztoč válce na nočním stadionu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlotLobby,
});
