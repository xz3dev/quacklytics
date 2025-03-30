import {Spinner} from "@/components/spinner.tsx";
import {useDuckDb} from "@app/duckdb/duckdb-provider.tsx";
import {TopLevelTaskType} from "@/services/duck-db-download-state.ts";
import {Check} from "lucide-react";

type TaskType = 'init' | TopLevelTaskType;

export function DuckDBLoadingIndicator(props: { children: React.ReactNode }) {
    const db = useDuckDb();
    const state = db.downloadState();

    if (!state.isLoading()) return props.children;

    const tasks = state.tasks;

    // Build a list of pending tasks
    let allTasks: { id: string; finished: boolean, type: TaskType, progress?: number }[] = [
        {id: "init", finished: tasks.init.finished, type: 'init'},
        ...tasks.load.map((t) => ({...t, type: 'load' as const})),
        ...tasks.import.map((t) => ({...t, type: 'import' as const})),
    ];

    const renderTask = (task: { id: string; finished: boolean, type: TaskType, progress?: number }) => {
        return (
            <div
                key={task.id + '-' + task.type}
                className="flex items-center justify-between p-3 border rounded-lg shadow-sm bg-muted/20 md:max-w-md mx-auto"
            >
                <span className="text-sm font-medium">
                    {task.type === "init" && "Initializing "}
                    {task.type === "load" && `Downloading ${task.id}`}
                    {task.type === "import" && `Importing ${task.id}`}

                    {task.progress !== undefined && ` (${task.progress}%)`}
                </span>
                {!task.finished && <Spinner/>}
                {task.finished && <Check />}
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <Spinner/>
            <div className="font-medium text-sm">Loading Data...</div>
            <div className="w-full mt-4 space-y-2">
                {allTasks.map(renderTask)}
            </div>
        </div>
    );
}
