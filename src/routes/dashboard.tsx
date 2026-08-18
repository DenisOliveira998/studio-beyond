import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PLATFORM_FEE,
  RATE_PER_CLICK,
  compact,
  money,
  worksByArtist,
} from "@/lib/beyond-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Artist dashboard — The Beyond" },
      {
        name: "description",
        content:
          "Track click revenue, donations received and platform fees across your published work.",
      },
      { property: "og:title", content: "Artist dashboard — The Beyond" },
      {
        property: "og:description",
        content: "A plain view of what your work earned this month.",
      },
    ],
  }),
  component: Dashboard;
});

const DONATIONS = [
  { from: "A. Ferreira", amount: 40, work: "A Quiet Taxonomy", when: "2 days ago" },
  { from: "Anonymous", amount: 15, work: "On Looking Longer", when: "4 days ago" },
  { from: "R. Silva", amount: 100, work: "A Quiet Taxonomy", when: "1 week ago" },
  { from: "M. Lindqvist", amount: 5, work: "On Looking Longer", when: "1 week ago" },
];

function Dashboard() {
  const works = worksByArtist("ines-halvorsen");
  const clicks = works.reduce((s, w) => s + w.clicks, 0);
  const clickGross = clicks * RATE_PER_CLICK;
  const donationGross = DONATIONS.reduce((s, d) => s + d.amount, 0);
  const gross = clickGross + donationGross;
  const fee = gross * PLATFORM_FEE;
  const net = gross - fee;

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">Artist dashboard · August 2026</p>
      <h1 className="mt-5 font-display text-5xl leading-tight tracking-tight">Inés Halvorsen</h1>

      <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Click revenue" value={money(clickGross)} note={`${compact(clicks)} counted views`} />
        <Stat label="Donations" value={money(donationGross)} note={`${DONATIONS.length} gifts`} />
        <Stat label="Platform fee (12%)" value={`−${money(fee)}`} note="Keeps the lights on" />
        <Stat label="Your payout" value={money(net)} note="Paid out Friday" accent />
      </div>

      <div className="mt-16 grid gap-16 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="font-display text-3xl tracking-tight">Performance by work</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {works.map((w) => {
              const earned = w.clicks * RATE_PER_CLICK * (1 - PLATFORM_FEE);
              return (
                <div key={w.id} className="flex items-baseline justify-between gap-6 py-5">
                  <div>
                    <Link
                      to="/work/$slug"
                      params={{ slug: w.slug }}
                      className="rule-hover font-display text-xl"
                    >
                      {w.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {compact(w.clicks)} views · {compact(w.likes)} likes
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-gilt">{money(earned)}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Mock counter: views are valued at {money(RATE_PER_CLICK)} each before the platform fee.
          </p>
        </section>

        <section>
          <h2 className="font-display text-3xl tracking-tight">Recent support</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {DONATIONS.map((d, i) => (
              <div key={i} className="flex items-baseline justify-between gap-6 py-5">
                <div>
                  <p className="text-sm">{d.from}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.work} · {d.when}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-gilt">{money(d.amount * (1 - PLATFORM_FEE))}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-background p-6">
      <p className="eyebrow">{label}</p>
      <p className={`mt-3 font-display text-4xl tracking-tight ${accent ? "text-gilt" : ""}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
