import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/tailwind";

export function CodeSnippet({
  children,
  label,
  className,
}: {
  children: string;
  /** What the copy button copies, when a page shows several snippets. */
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  // The button sits beside the scrolling code so long lines never run under it.
  return (
    <div
      className={cn("flex items-start rounded-md border bg-muted", className)}
    >
      <pre className="min-w-0 flex-1 overflow-x-auto py-3 pl-4 pr-2 font-mono text-xs">
        {children}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        aria-label={label ? `Copy ${label}` : "Copy"}
        className="m-1 size-8 shrink-0"
        onClick={() => {
          void navigator.clipboard.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
