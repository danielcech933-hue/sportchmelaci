import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/support/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Díky za podporu — Chmeloví Sportovci" },
      { name: "description", content: "Potvrzení dobrovolného příspěvku na provoz ligy Chmeloví Sportovci." },
      { property: "og:title", content: "Díky za podporu — Chmeloví Sportovci" },
      { property: "og:description", content: "Tvůj příspěvek pomáhá držet ligu v běhu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportReturn,
});

function SupportReturn() {
  const { session_id: sessionId } = Route.useSearch();
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-display text-4xl tracking-widest neon-text">
        {sessionId ? "🍻 DÍKY!" : "Nic k zobrazení"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {sessionId
          ? "Příspěvek dorazil. Potvrzení ti přijde e-mailem."
          : "Chybí informace o platbě."}
      </p>
      <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Zpět do lobby
      </Link>
    </main>
  );
}
