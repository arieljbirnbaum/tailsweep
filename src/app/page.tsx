import { DEFAULT_ZONE, loadAndEvaluate } from "@/adapters";
import type { CatalogItem } from "@/domain";
import { systemClock } from "@/time/system-clock";

import { formatCivilDate } from "./civil-date";
import { getAppDb } from "./db";
import { HandEnterForm, MarkDoneForm } from "./forms";
import { HAND_ENTER_CADENCE_OPTIONS } from "./hand-enter-cadence";

export const dynamic = "force-dynamic";

function zoneFor(catalog: readonly CatalogItem[], id: string): string {
  for (const item of catalog) {
    if (item.id === id) return item.zone;
  }
  throw new Error(`Due list id missing from catalog: ${id}`);
}

export default async function Home() {
  const db = await getAppDb();
  const { catalog, dueList } = await loadAndEvaluate(db, { clock: systemClock });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-10 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Duekeep</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Due</h2>
        <ul className="flex flex-col">
          {dueList.length === 0 ? (
            <li className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
              Nothing due.
            </li>
          ) : (
            dueList.map((view) => {
              const zone = zoneFor(catalog, view.id);
              const due =
                view.nextDue === null ? null : formatCivilDate(view.nextDue, zone);
              return (
                <li
                  key={view.id}
                  className="flex items-center justify-between gap-4 border-b border-zinc-200 py-3 dark:border-zinc-800"
                >
                  <div>
                    <p className="font-medium">{view.name}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {view.state}
                      {" · "}
                      {due === null ? "—" : <time dateTime={due}>{due}</time>}
                    </p>
                  </div>
                  <MarkDoneForm itemId={view.id} />
                </li>
              );
            })
          )}
        </ul>
      </section>

      <HandEnterForm
        defaultZone={DEFAULT_ZONE}
        cadenceOptions={HAND_ENTER_CADENCE_OPTIONS}
      />
    </main>
  );
}
