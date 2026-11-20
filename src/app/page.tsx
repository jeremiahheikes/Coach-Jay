import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SITE, STUDENT_RESULTS } from "@/lib/site";
import { AskIcon, ClubhouseIcon, ProgressIcon } from "@/components/club/WelcomeArt";

// proxy.ts sends signed-in users to their home; this is the public front page for everyone else.
export const metadata: Metadata = {
  title: { absolute: "Coach Jay — Golf Lessons at The Back Nine, North Arlington" },
  description: "Golf lessons with Coach Jay (Jeremiah Heikes) in North Arlington, TX. Launch-monitor data, slow-motion video, and a plan built for working adults. Join the free Clubhouse.",
};

const REASONS = [
  { title: "Numbers, not guesses", body: "Every swing is measured on a Full Swing launch monitor — carry, speed, launch, spin — so you know exactly what changed." },
  { title: "See it in slow motion", body: "Your swing on video from two angles, slowed down so you can see what Coach sees." },
  { title: "Built for working adults", body: "Small, specific changes that hold up on the course, not a full rebuild that takes a season." },
  { title: "Your progress, saved", body: "Notes, numbers, swing clips and homework live in the Coach Jay app on your phone." },
];

export default function FrontPage() {
  const loc = SITE.location;
  const q = encodeURIComponent(loc.address || loc.mapQuery);
  return (
    <div className="theme-light flex flex-col flex-1">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-line">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center gap-3">
          <span className="w-8 h-8 rounded-md bg-accent text-accent-ink grid place-items-center font-display font-bold">J</span>
          <span className="font-display font-bold text-xl leading-none flex-1">Coach Jay</span>
          <Link href="/login" className="text-sm font-semibold text-ink2 hover:text-ink px-2">Sign in</Link>
          <Link href="/signup" className="btn btn-sm btn-primary">Join free</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 pt-10 md:pt-14 flex flex-col items-center text-center">
          <h1 className="font-display font-bold uppercase tracking-tight leading-[.85] text-[22vw] md:text-[168px]">Dialed.</h1>
          <div className="relative -mt-3 md:-mt-6">
            <div className="absolute inset-0 -z-0 rounded-full bg-accent-soft scale-[1.18]" aria-hidden="true" />
            <Image
              src="/welcome/coach-jay-headshot.jpg" alt="Coach Jay (Jeremiah Heikes), golf instructor" width={480} height={480} priority
              className="relative w-48 h-48 md:w-60 md:h-60 rounded-full object-cover border-[6px] border-surface shadow-lg"
            />
          </div>
        </div>
        <div className="bg-accent mt-[-84px] pt-[108px] pb-10">
          <div className="max-w-xl mx-auto px-4">
            <div className="card !bg-accent-soft !border-transparent text-center flex flex-col gap-3 !p-6 md:!p-8 shadow-xl">
              <h2 className="text-3xl md:text-4xl font-bold">Is your game dialed in?</h2>
              <p className="m-0 text-ink2">Golf lessons with <b className="text-ink">Coach Jay</b> at The Back Nine, North Arlington — launch-monitor data, slow-motion video, and a plan you can feel on the course.</p>
              <div className="flex flex-col gap-2.5 mt-2">
                <Link href="/signup" className="btn btn-primary !py-3.5 uppercase tracking-wide">Book a lesson</Link>
                <Link href="/signup" className="btn !py-3.5 !bg-surface uppercase tracking-wide">Join the Clubhouse — free</Link>
              </div>
              <p className="m-0 text-xs text-ink3">PGA of America Associate (in program)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="max-w-5xl mx-auto w-full px-4 md:px-8 py-14 flex flex-col items-center gap-6">
        <h2 className="text-3xl md:text-5xl font-bold text-center">There&apos;s a bay waiting<br className="hidden md:block" /> <span className="text-accent">for you.</span></h2>
        <div className="card !p-0 overflow-hidden w-full max-w-3xl grid md:grid-cols-2">
          <div className="p-5 md:p-6 flex flex-col gap-2.5">
            <div className="eyebrow">Where lessons happen</div>
            <h3 className="text-2xl font-bold">{loc.name}</h3>
            <p className="m-0 text-sm text-ink2">Indoor Full Swing simulator bays — climate-controlled, rain or shine, and every shot tracked.</p>
            {loc.address && <p className="m-0 text-sm"><b className="font-semibold">Address</b><br />{loc.address}</p>}
            {loc.hours && <p className="m-0 text-sm"><b className="font-semibold">Hours</b><br />{loc.hours}</p>}
            <div className="flex gap-2 flex-wrap mt-auto pt-2">
              <Link href="/signup" className="btn btn-sm btn-primary">Book a lesson</Link>
              <a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Get directions ↗</a>
            </div>
          </div>
          <iframe
            title={`Map: ${loc.name}`} src={`https://www.google.com/maps?q=${q}&output=embed`}
            className="w-full h-64 md:h-full min-h-64 border-0 bg-surface2" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      {/* Coach story */}
      <section className="bg-bg border-y border-line">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-14 grid md:grid-cols-[auto_1fr] gap-8 items-center">
          <Image src="/welcome/coach-jay-headshot.jpg" alt="" width={480} height={480} className="w-40 h-40 md:w-52 md:h-52 rounded-full object-cover border-[6px] border-surface shadow-lg justify-self-center" />
          <div className="flex flex-col gap-3">
            <div className="eyebrow">Meet your coach</div>
            <h2 className="text-3xl md:text-4xl font-bold">Coach Jay — Jeremiah Heikes</h2>
            <p className="m-0 text-ink2">
              Coach Jay teaches the way he&apos;d want to be taught: with real numbers and real video, not vague feels. His strength is finding the
              one inconsistency that&apos;s costing you shots and making the smallest change that fixes it.
            </p>
            <p className="m-0 text-ink2">
              He coaches working adults — people with jobs, families and limited range time — and he still grinds on his own game, so he knows
              what it takes to get better on a real schedule.
            </p>
            <p className="m-0 text-sm text-ink3">PGA of America Associate (in program) · Teaching at The Back Nine Golf, North Arlington</p>
          </div>
        </div>
      </section>

      {/* Why Coach Jay */}
      <section className="max-w-5xl mx-auto w-full px-4 md:px-8 py-14 flex flex-col gap-8">
        <div className="text-center flex flex-col gap-2">
          <div className="eyebrow">Why Coach Jay?</div>
          <h2 className="text-3xl md:text-5xl font-bold">Most swings aren&apos;t broken.<br /><span className="text-accent">They&apos;re just not dialed.</span></h2>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {REASONS.map((r, i) => (
            <div key={r.title} className="card flex flex-col gap-2 !p-5">
              <span className="font-display font-bold text-4xl text-accent leading-none">0{i + 1}</span>
              <h3 className="text-xl font-bold">{r.title}</h3>
              <p className="m-0 text-sm text-ink2">{r.body}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {[
            { Icon: ClubhouseIcon, t: "The Clubhouse", d: "A free community to share range wins and swing clips, and find a foursome." },
            { Icon: AskIcon, t: "Ask the Coach", d: "Post a question with a clip. Coach Jay answers in public so everyone learns." },
            { Icon: ProgressIcon, t: "Lessons that stick", d: "Every lesson's numbers and slow-mo swings saved to your phone." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="flex gap-3 items-start">
              <Icon className="w-10 h-10 text-accent shrink-0" />
              <div><b className="font-display text-lg block">{t}</b><span className="text-sm text-ink2">{d}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* Student results — appears once real results are added in src/lib/site.ts */}
      {STUDENT_RESULTS.length > 0 && (
        <section className="bg-bg border-y border-line">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-14 flex flex-col gap-6">
            <div className="text-center flex flex-col gap-2">
              <div className="eyebrow">Student results</div>
              <h2 className="text-3xl md:text-5xl font-bold">Real students. <span className="text-accent">Measured.</span></h2>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {STUDENT_RESULTS.map((r) => (
                <div key={r.name + r.label} className="card flex flex-col gap-2 !p-5">
                  <span className="font-display font-bold text-5xl text-accent leading-none num">{r.stat}</span>
                  <span className="eyebrow">{r.label}{r.weeks ? ` · ${r.weeks} weeks` : ""}</span>
                  {r.before && r.after && (
                    <div className="flex items-center gap-2 text-sm num"><span className="chip">Before {r.before}</span>→<span className="chip chip-good">After {r.after}</span></div>
                  )}
                  {r.quote && <p className="m-0 text-sm text-ink2 italic">“{r.quote}”</p>}
                  <b className="text-sm mt-auto">— {r.name}</b>
                </div>
              ))}
            </div>
            <p className="m-0 text-xs text-ink3 text-center">Individual results vary.</p>
          </div>
        </section>
      )}

      {/* Closing call to action */}
      <section className="bg-accent text-accent-ink">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-14 text-center flex flex-col items-center gap-4">
          <h2 className="text-4xl md:text-6xl font-bold uppercase">Get dialed.</h2>
          <p className="m-0 opacity-90 max-w-lg">Join free to get into the Clubhouse and ask Coach Jay a question — or request your first lesson.</p>
          <div className="flex gap-2.5 flex-wrap justify-center">
            <Link href="/signup" className="btn !bg-accent-ink !text-accent !border-transparent !px-6 !py-3">Join free</Link>
            <Link href="/login" className="btn !bg-transparent !text-accent-ink !border-accent-ink/40 !px-6 !py-3">Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="max-w-5xl mx-auto w-full px-4 md:px-8 py-6 text-xs text-ink3 flex flex-wrap gap-x-4 gap-y-1 justify-between">
        <span>Coach Jay · Golf instruction at The Back Nine Golf, North Arlington, TX</span>
        <span>The Back Nine Golf and Full Swing are trademarks of their respective owners.</span>
      </footer>
    </div>
  );
}
