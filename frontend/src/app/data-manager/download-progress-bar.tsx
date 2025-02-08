import {Progress} from "@/components/ui/progress.tsx";

interface Props {
    state: 'success'| 'error' | 'pending'
    progress: number
}

export function DownloadProgressBar({state, progress}: Props) {
    return <div>
        <Progress value={progress} className="w-full"/>
        {state === "pending" && (
            <span className="text-sm text-gray-500 mt-1">
                Downloading {Math.ceil((progress / 100) * 5)} of 5 files...
            </span>
        )}
        {state === "error" && (
            <span className="text-sm text-red-500 mt-1">
                An error occurred while downloading files.
            </span>
        )}
    </div>
}
