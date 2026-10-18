import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="px-6 py-24">
      <h1 className="heading-page">Compasso</h1>
      <p className="mt-2 text-ink-soft">Gestão de marketing</p>
    </main>
  );
}
