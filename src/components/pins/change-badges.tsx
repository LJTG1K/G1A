import type { PinChanges } from "@/lib/pins";
import { formatPrice } from "@/lib/store";

const pill = "rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md";

/** Small pills over a pinned product's image describing what changed. */
export function ChangeBadges({ changes }: { changes: PinChanges }) {
  if (changes.removed) return <span className={`${pill} bg-black/70 text-white`}>No longer listed</span>;
  return (
    <>
      {changes.price && (
        <span className={`${pill} ${changes.price.to < changes.price.from ? "bg-success text-white" : "bg-[#ff9f0a] text-black"}`}>
          {changes.price.to < changes.price.from ? "↓" : "↑"} {formatPrice(changes.price.to)}
        </span>
      )}
      {changes.sheets && changes.sheets.to > changes.sheets.from && (
        <span className={`${pill} bg-accent text-accent-contrast`}>+{changes.sheets.to - changes.sheets.from} sheet</span>
      )}
      {changes.newImage && <span className={`${pill} bg-black/60 text-white`}>New photo</span>}
      {changes.renamed && <span className={`${pill} bg-black/60 text-white`}>Renamed</span>}
    </>
  );
}

/** Sentence form for the detail view. */
export function ChangeList({ changes, onSeen }: { changes: PinChanges; onSeen?: () => void }) {
  const lines: string[] = [];
  if (changes.removed) lines.push("No sheet in your store lists this any more. Showing the last known details.");
  if (changes.price) {
    const down = changes.price.to < changes.price.from;
    lines.push(`Price ${down ? "dropped" : "rose"} from ${formatPrice(changes.price.from)} to ${formatPrice(changes.price.to)}.`);
  }
  if (changes.sheets) lines.push(`Now in ${changes.sheets.to} ${changes.sheets.to === 1 ? "sheet" : "sheets"} (was ${changes.sheets.from}).`);
  if (changes.renamed) lines.push("The name changed since you pinned it.");
  if (changes.newImage) lines.push("It has a new photo.");
  if (!lines.length) return null;
  return (
    <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-3.5 text-sm">
      <p className="font-medium">Since you pinned it</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {onSeen && !changes.removed && (
        <button type="button" onClick={onSeen} className="mt-2 font-medium text-accent hover:underline">
          Mark as seen
        </button>
      )}
    </div>
  );
}
