import { agreeToRules } from "@/app/(club)/community/actions";

export const CLUB_RULES = [
  "Be the playing partner you'd want — encouraging, honest, no put-downs.",
  "Swing feedback is welcome; keep it kind and specific. Coach Jay has the final word on technique.",
  "No selling, spam or self-promotion without Coach Jay's OK.",
  "Keep it clean. Nothing hateful, harassing or explicit.",
  "Only post photos and video of yourself, or of people who've agreed to it.",
  "Members must be 18 or older.",
];

/** Shown in place of the Clubhouse until the member accepts the rules and confirms they're an adult. */
export function RulesGate({ first }: { first: string }) {
  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <header>
        <div className="eyebrow">The Clubhouse</div>
        <h1 className="text-3xl font-bold">Welcome in, {first}</h1>
        <p className="text-ink2 mt-1 mb-0">The Clubhouse is where golfers training with Coach Jay talk shop, share swings and find a game. One quick thing before you head in:</p>
      </header>
      <form action={agreeToRules} className="card flex flex-col gap-3">
        <h2 className="text-xl font-bold">House rules</h2>
        <ol className="m-0 pl-5 flex flex-col gap-1.5 text-sm text-ink2">{CLUB_RULES.map((r) => <li key={r}>{r}</li>)}</ol>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="rules" required className="mt-0.5" /> I&apos;ll follow the house rules.</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="adult" required className="mt-0.5" /> I&apos;m 18 or older.</label>
        <button className="btn btn-primary self-start">Enter the Clubhouse</button>
      </form>
    </div>
  );
}
