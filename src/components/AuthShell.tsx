export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent text-accent-ink grid place-items-center font-display font-bold text-xl">J</div>
          <div>
            <div className="font-display font-bold text-2xl leading-none">Coach Jay</div>
            <div className="eyebrow">Back Nine · North Arlington</div>
          </div>
        </div>
        <div className="card flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
