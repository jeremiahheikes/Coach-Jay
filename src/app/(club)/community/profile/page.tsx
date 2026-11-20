import { requireUser } from "@/lib/data";
import { ProfileForm } from "@/components/club/Forms";
import { CLUB_RULES } from "@/components/club/RulesGate";
import { signOut } from "@/app/(auth)/actions";

export default async function ClubProfilePage() {
  const { user, profile } = await requireUser();
  return (
    <>
      <p className="text-sm text-ink2 m-0">This is what other members see next to your posts. Signed in as {user.email}.</p>
      <ProfileForm name={profile.full_name} about={profile.about ?? ""} homeCourse={profile.home_course ?? ""} />
      <details className="card">
        <summary className="font-semibold cursor-pointer">House rules</summary>
        <ol className="mt-2 mb-0 pl-5 flex flex-col gap-1 text-sm text-ink2">{CLUB_RULES.map((r) => <li key={r}>{r}</li>)}</ol>
      </details>
      <form action={signOut} className="md:hidden"><button className="btn btn-sm">Sign out</button></form>
    </>
  );
}
