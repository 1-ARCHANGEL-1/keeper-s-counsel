import { createFileRoute, Link } from "@tanstack/react-router";
import { Keeper } from "@/components/Keeper";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Keeper — a kinder way through a hard conversation" },
      { name: "description", content: "Some fights aren't about who's right. Keeper listens to both sides, then shares only what's fair to share." },
      { property: "og:title", content: "Keeper" },
      { property: "og:description", content: "Some fights aren't about who's right. They're about what never got said." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-xl text-center page-in">
        <Keeper mood="rest" size={220} className="mx-auto" />
        <h1 className="mt-10 font-display text-5xl sm:text-6xl font-semibold tracking-tight">
          Keeper
        </h1>
        <p className="mt-6 text-base sm:text-lg leading-relaxed text-foreground/75 max-w-md mx-auto">
          Some fights aren't about who's right. They're about what never got said.
          Keeper listens to both sides, and shares only what's fair to share.
        </p>
        <Link
          to="/who"
          className="mt-10 inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--coral)_70%,transparent)] transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-[0_14px_36px_-12px_color-mix(in_oklab,var(--coral)_70%,transparent)]"
        >
          Start a conversation
        </Link>
      </div>
    </main>
  );
}
