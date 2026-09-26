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
import { useUpdateProjectName } from "@/services/projects";

export function RenameProjectDialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [error, setError] = useState("");
  const updater = useUpdateProjectName();
  const trimmedName = name.trim();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
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
                value: trimmedName,
              });
              toast.success("Project name updated!");
              onClose();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Failed to rename project. Please try again.",
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
                trimmedName === project.name
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
