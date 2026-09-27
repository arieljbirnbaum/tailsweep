export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 font-sans dark:bg-zinc-950">
      <main className="flex w-full max-w-lg flex-col gap-6">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Ailurid
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Duekeep
        </h1>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Completion-anchored chore cadence. Engine before chrome — implement{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-sm dark:bg-zinc-800">
            src/engine
          </code>{" "}
          until <code className="font-mono text-sm">pnpm test</code> is green.
        </p>
        <ul className="list-inside list-disc text-sm text-zinc-500 dark:text-zinc-500">
          <li>
            Architecture: <span className="font-mono">ARCHITECTURE.md</span>
          </li>
          <li>
            Contract tests:{" "}
            <span className="font-mono">src/engine/evaluate.test.ts</span>
          </li>
        </ul>
      </main>
    </div>
  );
}
