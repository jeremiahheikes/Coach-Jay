"use client";
import { useActionState, useTransition, useState } from "react";
import { requestLesson, setFreeTip, updateClubProfile, type ClubState } from "@/app/(club)/community/actions";

export function ProfileForm({ name, about, homeCourse }: { name: string; about: string; homeCourse: string }) {
  const [state, action, pending] = useActionState<ClubState, FormData>(updateClubProfile, {});
  return (
    <form action={action} className="card flex flex-col gap-3">
      <div className="flex flex-col gap-1"><label className="label" htmlFor="full_name">Name</label><input className="input" id="full_name" name="full_name" defaultValue={name} maxLength={80} required /></div>
      <div className="flex flex-col gap-1"><label className="label" htmlFor="home_course">Home course</label><input className="input" id="home_course" name="home_course" defaultValue={homeCourse} maxLength={80} placeholder="e.g. Bear Creek, Tierra Verde…" /></div>
      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="about">About your game</label>
        <textarea className="input min-h-[90px]" id="about" name="about" defaultValue={about} maxLength={500} placeholder="Handicap or typical score, how often you play, what you'd most like to fix." />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
        {state.ok && <span className="text-sm text-good">Saved.</span>}
        {state.error && <span role="alert" className="text-sm text-bad">{state.error}</span>}
      </div>
    </form>
  );
}

export function RequestLessonForm() {
  const [state, action, pending] = useActionState<ClubState, FormData>(requestLesson, {});
  if (state.ok) return <p className="text-sm text-good m-0">Got it — Coach Jay will reach out to set up a time.</p>;
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1"><label className="label" htmlFor="phone">Best phone number</label><input className="input" id="phone" name="phone" type="tel" autoComplete="tel" required /></div>
      <div className="flex flex-col gap-1"><label className="label" htmlFor="message">What would you like to work on? (optional)</label><textarea className="input min-h-[70px]" id="message" name="message" maxLength={1000} placeholder="e.g. Slicing the driver, want to break 90 this season. Weekday evenings work best." /></div>
      <button className="btn btn-primary self-start" disabled={pending}>{pending ? "Sending…" : "Request a lesson"}</button>
      {state.error && <p role="alert" className="text-sm text-bad m-0">{state.error}</p>}
    </form>
  );
}

/** Coach library: toggle whether a lesson shows as a free tip on the Welcome hub. */
export function FreeTipToggle({ videoId, isFree }: { videoId: string; isFree: boolean }) {
  const [on, setOn] = useState(isFree);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink2 cursor-pointer">
      <input type="checkbox" checked={on} disabled={pending} onChange={(e) => { const v = e.target.checked; setOn(v); start(() => setFreeTip(videoId, v)); }} />
      Free tip on Welcome page
    </label>
  );
}
