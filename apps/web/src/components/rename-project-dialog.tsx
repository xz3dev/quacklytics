import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Project } from "@/model/project";
import { useUpdateProjectDetails } from "@/services/projects";
import { ProjectAvatar } from "@/app/projects/projects-shell";
import { ProjectEmojiPopover } from "./project-emoji-popover";

export function RenameProjectDialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [emoji, setEmoji] = useState(project.emoji);
  const [error, setError] = useState("");
  const updater = useUpdateProjectDetails();
  const trimmedName = name.trim();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!trimmedName || updater.isPending) return;
            setError("");
            try {
              await updater.mutateAsync({
                projectId: project.id,
                name: trimmedName,
                emoji,
              });
              toast.success(
                emoji === project.emoji
                  ? "Project name updated!"
                  : "Project updated!",
              );
              onClose();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Failed to update project. Please try again.",
              );
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="rename-project-name">Project name</Label>
            <Input
              id="rename-project-name"
              value={name}
              maxLength={200}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Project emoji</Label>
            <div className="flex items-center gap-3">
              <ProjectEmojiPopover
                onSelect={(selected) => {
                  setEmoji(selected);
                  setError("");
                }}
                anchor={
                  <ProjectAvatar
                    name={trimmedName}
                    emoji={emoji}
                    className="size-10 text-lg"
                  />
                }
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Choose project emoji"
                  >
                    {emoji ? "Change emoji" : "Choose emoji"}
                  </Button>
                }
              />
              {emoji && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmoji("")}
                >
                  Remove emoji
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Shown in project tiles. Leave empty to use the first letter.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                updater.isPending ||
                !trimmedName ||
                (trimmedName === project.name && emoji === project.emoji)
              }
            >
              {updater.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
