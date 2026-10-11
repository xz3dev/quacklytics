import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/tailwind";

export function CodeSnippet({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("relative", className)}>
      <pre className="overflow-x-auto rounded-md border bg-muted px-4 py-3 pr-12 font-mono text-xs">
        {children}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Copy"
        className="absolute right-1 top-1 size-8"
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
