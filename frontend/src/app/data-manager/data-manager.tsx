import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "@radix-ui/react-popover";
import {cn} from "@/lib/utils"; // Optional: For utility class merging
import {AlertCircleIcon, ArrowDownCircleIcon, HardDrive} from "lucide-react";
import {AutoDownloadRangeSelector} from "@app/data-manager/auto-download-range-selector.tsx";
import {Card} from "@/components/ui/card.tsx";
import {DownloadProgressBar} from "@app/data-manager/download-progress-bar.tsx";
import {useDownloadFile, useFileCatalog} from "@/services/file-catalog.ts";
import {Spinner} from "@/components/spinner.tsx";
import {useProjectId} from "@/hooks/use-project-id.tsx";

export function DataManager() {
    const [progress,] = useState<number>(0);
    const [storageUsed,] = useState({used: 45, total: 200});

    const projectId = useProjectId()

    const availableFiles = useFileCatalog(projectId)
    const fileDownloader = useDownloadFile()

    const statusIcon = {
        success: <HardDrive className="h-4 w-4 text-muted"/>,
        pending: <ArrowDownCircleIcon className="h-4 w-4 text-primary-foreground animate-pulse"/>,
        error: <AlertCircleIcon className="h-4 w-4 text-red-600"/>
    };

    if (availableFiles.status === 'pending') {
        return <Spinner/>;
    }
    if (availableFiles.status === 'error') {
        return availableFiles.error.message
    }

    return (
        <div className="z-50">
            {/* Data Manager Button */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button className="flex items-center justify-between gap-2">
                        Data Manager
                        {statusIcon[availableFiles.status]}
                    </Button>
                </PopoverTrigger>

                {/* Popup Content */}
                <PopoverContent align="end" sideOffset={8} side="bottom">
                    <Card className="p-4 max-h-96 overflow-y-auto">

                        <label
                            className="block mb-1.5 text-xs font-medium text-muted-foreground">
                            Auto-Download Range
                        </label>
                        <AutoDownloadRangeSelector></AutoDownloadRangeSelector>

                        <label
                            className="block mb-1.5 mt-3 text-xs font-medium text-muted-foreground"
                        >
                            Download Progress
                        </label>
                        <DownloadProgressBar state={availableFiles.status} progress={progress}></DownloadProgressBar>

                        {/* Storage Consumption */}
                        <div>
                            <label className="block mb-1.5 mt-3 text-xs font-medium text-muted-foreground">Storage
                                Consumption</label>
                            <div className="flex items-center justify-between text-sm">
                                <span>{storageUsed.used} MB / {storageUsed.total} MB</span>
                                <div
                                    className={cn(
                                        {"bg-red-300": storageUsed.used / storageUsed.total > 0.9}
                                    )}
                                >
                                    <div
                                        className="bg-blue-500 h-full"
                                        style={{width: `${(storageUsed.used / storageUsed.total) * 100}%`}}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block mb-1.5 mt-3 text-xs font-medium text-muted-foreground">Available
                                Files</label>
                            <div className="flex flex-col gap-1 items-center justify-between text-sm">
                                <div>{availableFiles.data?.length ?? 0}</div>
                                {availableFiles.data?.map((file) => (
                                    <Button
                                        key={file.name}
                                        className="self-stretch"
                                        variant="outline"
                                        onClick={() => fileDownloader.mutate({projectId, fileName: file.name})}
                                    >
                                        Download {file.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </Card>
                </PopoverContent>
            </Popover>
        </div>
    )
};
