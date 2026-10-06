export function NotLinked({ email }: { email: string }) {
  return (
    <div className="card flex flex-col gap-2">
      <h2 className="text-xl font-bold">You&apos;re signed in, but not on a roster yet</h2>
      <p className="text-ink2 text-sm m-0">
        Your coach adds students by email. Ask Coach Jay to add <b>{email}</b> and this page will fill in with your lessons, numbers and videos.
      </p>
    </div>
  );
}
