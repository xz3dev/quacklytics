import {create} from "zustand";

export interface DownloadTask {
    id: string
    finished: boolean;
}

export interface DownloadTaskProgress {
    progress?: number
}

export interface DuckDbDownloadState {
    tasks: Tasks
    addTask: (id: string, type: TopLevelTaskType) => void;
    updateTaskProgress: (id: string, type: TopLevelTaskType, progress: number) => void;
    finishTask: (id: string, type: TopLevelTaskType) => void;
    isLoading: () => boolean;
    finishInit: () => void;
}

export type TopLevelTaskType = 'load' | 'import'

interface Tasks {
    init: {
        finished: boolean;
    }
    load: (DownloadTask & DownloadTaskProgress)[]
    import: DownloadTask[]
}


export const useDuckDbDownloadStore = () => create<DuckDbDownloadState>((set, get) => ({
    tasks: {
        init: {
            finished: false,
        },
        load: [
            {
                id: 'Metadata',
                finished: false,
            },
            {
                id: 'Recent Events',
                finished: false,
            },
        ],
        import: [
        ],
    },

    addTask: (id: string, parent: TopLevelTaskType) =>
        set((state) => {
            return ({
                tasks: {
                    ...state.tasks,
                    [parent]: [...state.tasks[parent], {id, finished: false}],
                }
            })
        }),

    updateTaskProgress(id: string, type: TopLevelTaskType, progress: number) {
        set((state) => ({
            tasks: {
                ...state.tasks,
                load: state.tasks.load.map((task) => type === 'load' && task.id === id ? {
                    ...task,
                    progress,
                } : task),
                import: state.tasks.import.map((task) => type === 'import' && task.id === id ? {
                    ...task,
                    progress,
                } : task),
            }
        }))
    },

    finishTask: (id: string, type: TopLevelTaskType) =>
        set((state) => ({
            tasks: {
                ...state.tasks,
                load: state.tasks.load.map((task) => type === 'load' && task.id === id ? {
                    ...task,
                    finished: true
                } : task),
                import: state.tasks.import.map((task) => type === 'import' && task.id === id ? {
                    ...task,
                    finished: true
                } : task),
            }
        })),

    finishInit: () => set((state) => ({
        tasks: {
            ...state.tasks,
            init: {finished: true},
        }
    })),

    isLoading: () => {
        const {tasks} = get();

        // Check the initialization task
        if (!tasks.init.finished) {
            return true;
        }

        // Check tasks in the "load" array
        if (tasks.load.some(task => !task.finished)) {
            return true;
        }

        // Check tasks in the "import" array
        if (tasks.import.some(task => !task.finished)) {
            return true;
        }

        return false;

    },
}));
