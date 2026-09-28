/**
 * Due-engine behavioral contract — rule IDs for coverage checking.
 *
 * Rules with `enforced: "test"` MUST be listed in ≥1 `covers` entry on a
 * case in `evaluate.test.ts`. The meta-test in that file fails the suite if
 * any testable rule is missing (contract coverage, not line coverage).
 *
 * Keep ARCHITECTURE.md state rules in sync when you add/rename IDs here.
 */
export const ENGINE_CONTRACT_RULES = {
  "state.paused": {
    summary: "paused → not_applicable; nextDue null",
    enforced: "test",
  },
  "state.as_needed.done": {
    summary: "as_needed + lastDone → not_applicable; nextDue null",
    enforced: "test",
  },
  "state.as_needed.never": {
    summary:
      "as_needed never done → due; nextDue = start of today in item.zone",
    enforced: "test",
  },
  "state.scheduled.never": {
    summary:
      "scheduled cadence never done → overdue; nextDue = start of today in item.zone",
    enforced: "test",
  },
  "state.compare.overdue": {
    summary: "nextDue local date < today → overdue",
    enforced: "test",
  },
  "state.compare.due": {
    summary: "nextDue local date === today → due",
    enforced: "test",
  },
  "state.compare.upcoming": {
    summary: "today < nextDue local date ≤ today+horizon → upcoming",
    enforced: "test",
  },
  "state.compare.beyond_horizon": {
    summary: "nextDue local date > today+horizon → not_applicable",
    enforced: "test",
  },
  "horizon.inclusive_boundary": {
    summary: "nextDue local date === today+horizonDays → upcoming (≤)",
    enforced: "test",
  },
  "nextdue.start_of_local_day": {
    summary:
      "non-null nextDue is the start-of-day Instant of the due local date in item.zone (not wall-clock now)",
    enforced: "test",
  },
  "nextdue.null_when_not_applicable": {
    summary: "nextDue is null when state is not_applicable for paused / as_needed done",
    enforced: "test",
  },
  "cadence.daily": {
    summary: "daily → +1 calendar day from lastDone local date",
    enforced: "test",
  },
  "cadence.weekly": {
    summary: "weekly → +7 calendar days from lastDone local date",
    enforced: "test",
  },
  "cadence.monthly": {
    summary: "monthly → +1 calendar month from lastDone local date",
    enforced: "test",
  },
  "cadence.quarterly": {
    summary: "quarterly → +3 calendar months from lastDone local date",
    enforced: "test",
  },
  "cadence.yearly": {
    summary: "yearly → +1 calendar year from lastDone local date",
    enforced: "test",
  },
  "cadence.every_n_days": {
    summary: "every_n_days → +N calendar days from lastDone local date",
    enforced: "test",
  },
  "catalog.preserves_order": {
    summary: "evaluateCatalog results match input order 1:1",
    enforced: "test",
  },
  "api.zone_required": {
    summary: "CatalogItem.zone required; no options.timeZone / engine UTC default",
    enforced: "types",
  },
  "api.horizon_required": {
    summary: "EvaluateOptions.horizonDays required; no engine default",
    enforced: "types",
  },
  "lint.no_date": {
    summary: "Date banned repo-wide (ESLint)",
    enforced: "eslint",
  },
  "lint.no_temporal_now_in_engine": {
    summary: "Temporal.Now banned under src/engine (ESLint)",
    enforced: "eslint",
  },
} as const;

export type ContractRuleId = keyof typeof ENGINE_CONTRACT_RULES;

export type TestEnforcedRuleId = {
  [K in ContractRuleId]: (typeof ENGINE_CONTRACT_RULES)[K]["enforced"] extends "test"
    ? K
    : never;
}[ContractRuleId];

export function testEnforcedRuleIds(): TestEnforcedRuleId[] {
  return (Object.keys(ENGINE_CONTRACT_RULES) as ContractRuleId[]).filter(
    (id): id is TestEnforcedRuleId =>
      ENGINE_CONTRACT_RULES[id].enforced === "test",
  );
}
