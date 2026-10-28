import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";

export function InsightName({
  name,
  onRename,
  disabled,
}: {
  name: string | undefined;
  onRename: (name: string) => Promise<void>;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const editActive = useRef(false);
  const renameButton = useRef<HTMLButtonElement>(null);
  const displayName = name || "Untitled insight";

  const saveName = async () => {
    if (!editActive.current || saving || disabled) return;
    editActive.current = false;
    setEditing(false);
    const nextName = draft.trim();
    if (!nextName || nextName === displayName) return;
    setSaving(true);
    setError(false);
    try {
      await onRename(nextName);
    } catch {
      setError(true);
      editActive.current = true;
      setEditing(true);
    } finally {
      setSaving(false);
    }
  };

  if (!editing)
    return (
      <h2 className="min-w-0 wrap-break-word text-2xl font-bold">
        <button
          ref={renameButton}
          type="button"
          aria-label={`Rename ${displayName}`}
          disabled={disabled || saving}
          className="group inline-flex max-w-full items-center gap-2 rounded-md text-left outline-hidden hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            editActive.current = true;
            setDraft(displayName);
            setError(false);
            setEditing(true);
          }}
        >
          <span className="min-w-0 wrap-break-word">{displayName}</span>
          <Pencil
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground opacity-40 group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </button>
      </h2>
    );

  return (
    <div className="min-w-0 flex-1">
      <Input
        autoFocus
        aria-label="Insight name"
        maxLength={200}
        value={draft}
        disabled={saving || disabled}
        className="h-10 text-lg font-semibold"
        onFocus={(event) => event.target.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void saveName()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            editActive.current = false;
            setEditing(false);
            setError(false);
            requestAnimationFrame(() => renameButton.current?.focus());
          } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Could not rename insight. Please try again.
        </p>
      )}
    </div>
  );
}
