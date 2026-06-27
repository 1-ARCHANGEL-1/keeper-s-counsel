import { createFileRoute, Link } from "@tanstack/react-router";
import { Keeper } from "@/components/Keeper";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Keeper — a kinder way through a hard conversation" },
      {
        name: "description",
        content:
          "Some fights aren't about who's right. Keeper listens to both sides, then shares only what's fair to share.",
      },
      { property: "og:title", content: "Keeper" },
      {
        property: "og:description",
        content:
          "Some fights aren't about who's right. They're about what never got said.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      {/* Scoped styles — nothing here leaks to other routes */}
      <style>{`
        @keyframes keeper-rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .keeper-stagger > * {
          opacity: 0;
          animation: keeper-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .keeper-stagger > *:nth-child(1) { animation-delay: 0.05s; }
        .keeper-stagger > *:nth-child(2) { animation-delay: 0.18s; }
        .keeper-stagger > *:nth-child(3) { animation-delay: 0.31s; }
        .keeper-stagger > *:nth-child(4) { animation-delay: 0.44s; }
        .keeper-stagger > *:nth-child(5) { animation-delay: 0.57s; }

        .keeper-glow {
          position: relative;
        }
        .keeper-glow::before {
          content: "";
          position: absolute;
          inset: -18%;
          z-index: -1;
          border-radius: 9999px;
          background: radial-gradient(
            closest-side,
            color-mix(in oklab, var(--coral) 22%, transparent),
            transparent 72%
          );
          filter: blur(6px);
          pointer-events: none;
        }

        .keeper-cta {
          transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 0.45s ease-out;
        }
        .keeper-cta:hover {
          transform: translateY(-1px) scale(1.02);
        }
        .keeper-cta:active {
          transform: translateY(0) scale(0.99);
          transition-duration: 0.12s;
        }
        .keeper-cta:focus-visible {
          outline: 2px solid color-mix(in oklab, var(--coral) 75%, transparent);
          outline-offset: 3px;
        }

        @media (prefers-reduced-motion: reduce) {
          .keeper-stagger > * { opacity: 1; animation: none; }
          .keeper-cta, .keeper-cta:hover, .keeper-cta:active { transform: none; }
        }
      `}</style>

      <div className="w-full max-w-xl text-center keeper-stagger page-in">
        <div className="mx-auto w-fit keeper-glow">
          <Keeper mood="rest" size={200} className="mx-auto" />
        </div>

        <h1 className="mt-8 font-display text-5xl sm:text-6xl font-semibold tracking-tight">
          Keeper
        </h1>

        <p className="mt-5 text-base sm:text-lg leading-relaxed text-foreground/75 max-w-md mx-auto">
          Some fights aren't about who's right. They're about what never got
          said. Keeper listens to both sides, and shares only what's fair to
          share.
        </p>

        <Link
          to="/who"
          className="mt-8 keeper-cta inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--coral)_70%,transparent)]"
        >
          Start a conversation
        </Link>

        <p className="mt-4 text-sm text-foreground/50">
          Takes about five minutes. Nothing is shared without your say.
        </p>
      </div>
    </main>
  );
}