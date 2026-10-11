import { lazy, Suspense, useState, type ReactNode } from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const EmojiPicker = lazy(() => import("./project-emoji-picker"));

/**
 * Opens the emoji picker in a popover attached to `anchor` (the project
 * icon), followed by the `trigger` that toggles it.
 */
export function ProjectEmojiPopover({
  anchor,
  trigger,
  onSelect,
}: {
  anchor: ReactNode;
  trigger: ReactNode;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    // Modal, so the picker still scrolls inside dialogs that lock scrolling.
    <Popover modal open={open} onOpenChange={setOpen}>
      {/* The trigger sits inside the anchor: Radix lets the last registered
          anchor win, and child refs attach before their parent's. */}
      <PopoverAnchor className="flex items-center gap-3">
        {anchor}
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-auto overflow-hidden rounded-xl p-0"
        // The picker focuses its own search field.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Suspense
          fallback={
            <p className="flex h-[400px] w-[340px] items-center justify-center text-sm text-muted-foreground">
              Loading emojis…
            </p>
          }
        >
          <EmojiPicker
            onEmojiClick={(selection) => {
              onSelect(selection.emoji);
              setOpen(false);
            }}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
