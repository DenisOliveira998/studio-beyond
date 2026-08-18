import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Join The Beyond — Artists & Supporters" },
      {
        name: "description",
        content:
          "Create an artist account to publish and earn, or join as a supporter to follow and fund the work you love.",
      },
      { property: "og:title", content: "Join The Beyond" },
      {
        property: "og:description",
        content: "Separate sign-up for artists and supporters. No ads, ever.",
      },
    ],
  }),
  component: AuthPage,
});

type Role = "artist" | "supporter";
type Mode = "signup" | "login";

const copy: Record<Role, { title: string; blurb: string; extra?: string }> = {
  artist: {
    title: "Publish and get paid",
    blurb:
      "Upload writing, images, audio or illustration. Earn on every counted view, plus direct gifts from supporters.",
    extra: "Discipline",
  },
  supporter: {
    title: "Follow the work you love",
    blurb: "Save artists, get their new work in a quiet feed, and send support whenever you want.",
  },
};

function AuthPage() {
  const [role, setRole] = useState<Role>("artist");
  const [mode, setMode] = useState<Mode>("signup");

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
      <div>
        <p className="eyebrow">{mode === "signup" ? "Create an account" : "Welcome back"}</p>
        <h1 className="mt-5 font-display text-5xl leading-tight tracking-tight sm:text-6xl">
          {copy[role].title}
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
          {copy[role].blurb}
        </p>
        <ul className="mt-10 space-y-3 border-t border-border pt-8 text-sm text-muted-foreground">
          <li>No advertising, ever — the feed is only work.</li>
          <li>88% of click revenue and donations goes to the artist.</li>
          <li>Payouts weekly, no minimum threshold.</li>
        </ul>
      </div>

      <div className="border border-border bg-surface p-7 sm:p-9">
        <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
          {(["artist", "supporter"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`bg-background py-3 text-xs uppercase tracking-[0.18em] transition-colors ${
                role === r ? "text-gilt" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "artist" ? "Artist" : "Supporter"}
            </button>
          ))}
        </div>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            toast.success(
              mode === "signup"
                ? `${role === "artist" ? "Artist" : "Supporter"} account created (demo).`
                : "Signed in (demo).",
            );
          }}
        >
          {mode === "signup" && <Field label="Full name" type="text" placeholder="Your name" />}
          {mode === "signup" && role === "artist" && (
            <Field label="Discipline" type="text" placeholder="Painter, essayist, composer…" />
          )}
          <Field label="Email" type="email" placeholder="you@studio.com" />
          <Field label="Password" type="password" placeholder="••••••••" />

          <button
            type="submit"
            className="w-full bg-primary py-3 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90"
          >
            {mode === "signup"
              ? role === "artist"
                ? "Create artist account"
                : "Create supporter account"
              : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="mt-6 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New to The Beyond? Create an account"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  placeholder,
}: {
  label: string;
  type: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        required
        placeholder={placeholder}
        className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
      />
    </label>
  );
}
