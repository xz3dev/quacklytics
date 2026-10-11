import type { CSSProperties } from "react";
import EmojiPicker, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";
import { useTheme } from "@/components/theme/theme-provider";

// The picker's colors, mapped onto the app's tokens so it matches the
// surrounding popover in light and dark mode.
const tokens: CSSProperties & Record<`--${string}`, string> = {
  border: "none",
  "--epr-picker-border-radius": "0",
  "--epr-bg-color": "hsl(var(--popover))",
  "--epr-category-label-bg-color": "hsl(var(--popover) / 0.95)",
  "--epr-text-color": "hsl(var(--popover-foreground))",
  "--epr-category-label-text-color": "hsl(var(--muted-foreground))",
  "--epr-category-icon-inactive-color": "hsl(var(--muted-foreground))",
  "--epr-category-icon-active-color": "hsl(var(--foreground))",
  "--epr-highlight-color": "hsl(var(--foreground))",
  "--epr-hover-bg-color": "hsl(var(--accent))",
  "--epr-hover-bg-color-reduced-opacity": "hsl(var(--accent) / 0.5)",
  "--epr-focus-bg-color": "hsl(var(--accent))",
  "--epr-search-input-bg-color": "hsl(var(--muted))",
  "--epr-search-input-bg-color-active": "hsl(var(--muted))",
  "--epr-search-input-text-color": "hsl(var(--foreground))",
  "--epr-search-input-placeholder-color": "hsl(var(--muted-foreground))",
  "--epr-search-border-color": "transparent",
  "--epr-search-border-color-active": "hsl(var(--ring))",
  "--epr-skin-tone-picker-menu-color": "hsl(var(--popover) / 0.95)",
  "--epr-emoji-variation-picker-bg-color": "hsl(var(--popover))",
  "--epr-picker-border-color": "hsl(var(--border))",
};

export default function ProjectEmojiPicker({
  onEmojiClick,
}: {
  onEmojiClick: (selection: EmojiClickData) => void;
}) {
  // Theme.AUTO follows the OS, not the theme chosen in the app.
  const { effective } = useTheme();
  return (
    <EmojiPicker
      width={340}
      height={400}
      emojiStyle={EmojiStyle.NATIVE}
      theme={effective === "dark" ? Theme.DARK : Theme.LIGHT}
      previewConfig={{ showPreview: false }}
      autoFocusSearch
      style={tokens}
      onEmojiClick={onEmojiClick}
    />
  );
}
