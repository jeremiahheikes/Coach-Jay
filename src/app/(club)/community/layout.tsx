import { requireUser } from "@/lib/data";
import { RulesGate } from "@/components/club/RulesGate";
import { ClubTabs } from "./ClubTabs";

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const isCoach = profile.role === "coach";
  if (!isCoach && !profile.agreed_rules_at) return <RulesGate first={profile.full_name.split(" ")[0] || "golfer"} />;
  return (
    <>
      <header>
        <div className="eyebrow">Coach Jay · Back Nine</div>
        <h1 className="text-2xl md:text-3xl font-bold">The Clubhouse</h1>
      </header>
      {profile.banned_at && <div className="card border-bad text-sm">Your posting access is paused. You can still read along. Questions? Talk to Coach Jay.</div>}
      <ClubTabs isCoach={isCoach} />
      {children}
    </>
  );
}
