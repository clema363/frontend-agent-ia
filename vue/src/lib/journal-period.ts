export const journalPeriods = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

type PeriodFilter = { period: string; from: string; to: string };

// Calendar dates use the user's local timezone, including daylight-saving changes.
export function isInJournalPeriod(
  at: string,
  filters: PeriodFilter,
  now = new Date(),
) {
  const timestamp = new Date(at).getTime();
  if (!Number.isFinite(timestamp)) return false;
  let start: Date | undefined;
  let end: Date | undefined;
  if (filters.period === "custom") {
    if (filters.from) start = new Date(`${filters.from}T00:00:00`);
    if (filters.to) {
      end = new Date(`${filters.to}T00:00:00`);
      end.setDate(end.getDate() + 1);
    }
  } else if (["today", "7", "30"].includes(filters.period)) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(start);
    end.setDate(end.getDate() + 1);
    start.setDate(
      start.getDate() -
        (filters.period === "today" ? 0 : Number(filters.period) - 1),
    );
  }
  return (
    (!start || timestamp >= start.getTime()) &&
    (!end || timestamp < end.getTime())
  );
}

export function journalDay(at: string) {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
