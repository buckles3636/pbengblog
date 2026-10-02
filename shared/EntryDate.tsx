export function EntryDate({ value }: { value?: string }) {
  if (!value) return null;
  const label = value.length === 4 ? value : new Date(value + (value.length === 7 ? "-01" : "") + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "short", ...(value.length === 10 ? { day: "numeric" as const } : {}), timeZone: "UTC" });
  return <time className="entry-date" dateTime={value}>Entry · {label}</time>;
}
