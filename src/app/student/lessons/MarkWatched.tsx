"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markWatched } from "../actions";

export function MarkWatched({ assignmentId }: { assignmentId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button className="btn btn-sm w-full" disabled={pending} onClick={() => start(async () => { await markWatched(assignmentId); router.refresh(); })}>{pending ? "…" : "Mark watched"}</button>;
}
