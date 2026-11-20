"use client";
import { useTransition } from "react";
import { markRequestHandled, resolveReport, setBan } from "@/app/(club)/community/actions";

export function ResolveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="btn btn-sm" disabled={pending} onClick={() => start(() => resolveReport(id))}>Mark resolved</button>;
}
export function HandledButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="btn btn-sm" disabled={pending} onClick={() => start(() => markRequestHandled(id))}>Mark handled</button>;
}
export function BanButton({ member, banned }: { member: string; banned: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className={`btn btn-sm ${banned ? "" : "!text-bad"}`} disabled={pending}
      onClick={() => { if (banned || confirm("Pause this member's posting? They can still read.")) start(() => setBan(member, !banned)); }}>
      {banned ? "Restore posting" : "Pause posting"}
    </button>
  );
}
