import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "@radix-ui/react-popover";
import {AlertCircleIcon, ArrowDownCircleIcon, HardDrive, Info, RefreshCw} from "lucide-react";
import {AutoDownloadRangeSelector} from "@app/data-manager/auto-download-range-selector.tsx";
import {Card} from "@/components/ui/card.tsx";
import {FileMetadata, useDownloadFile, useFileCatalog} from "@/services/file-catalog.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {format} from "date-fns";
import {Spinner} from "@/components/spinner.tsx";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {useDuckDb} from "@app/duckdb/duckdb-provider.tsx";

export function DataManager() {
    const [isOpen, setIsOpen] = useState(false);
    const [isDbWorking, setIsDbWorking] = useState(false);

    const projectId = useProjectId()

    const availableFiles = useFileCatalog(projectId)
    const fileDownloader = useDownloadFile()
    const db = useDuckDb()
    const dataRanges = db.dataRanges()

    const statusIcon = {
        success: <HardDrive className="h-4 w-4"/>,
        pending: <ArrowDownCircleIcon className="h-4 w-4 animate-pulse"/>,
        error: <AlertCircleIcon className="h-4 w-4 text-red-600"/>
    };

    const availableFilesData = availableFiles.data ?? []

    const storageConsumption = availableFilesData
        .filter(file => dataRanges.isLoaded(file))
        .reduce((acc, file) => (acc ?? 0) + file.filesize, 0)

    const rawOptions = availableFilesData
        .filter(file => file.eventCount > 0 && !dataRanges.isLoaded(file))
        .sort((a, b) => b.start.localeCompare(a.start))

    const downloadOptions = rawOptions.reduce((acc, file, index) => {
        const prev = acc[index - 1]
        const previousSize = index > 0 ? prev?.accSize || 0 : 0;
        const accumulatedSize = previousSize + file.filesize;
        acc.push({
            ...file,
            accSize: accumulatedSize,
            files: [...(prev?.files ?? []), file]
        });
        return acc;
    }, [] as Array<{ accSize: number, files: FileMetadata[] } & typeof rawOptions[0]>);

    async function loadFiles(files: FileMetadata[]) {
        setIsDbWorking(true)
        const promises = files.map(file => fileDownloader.mutateAsync({projectId, file}))
        await Promise.all(promises)
        setIsDbWorking(false)
    }

    return (
        <div className="z-50">
            <Popover onOpenChange={setIsOpen} open={isOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="secondary"
                    >
                        Data Manager
                        {statusIcon[availableFiles.status]}
                    </Button>
                </PopoverTrigger>

                {/* Popup Content */}
                <PopoverContent
                    align="end"
                    sideOffset={8}
                    side="bottom"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <Card className="p-4 max-h-96 overflow-y-auto relative">
                        {isDbWorking && <div
                            className="absolute inset-0 flex items-center justify-center bg-muted/40 backdrop-blur-sm">
                            <Spinner></Spinner>
                        </div>}
                        <div className="flex flex-row gap-2 items-center justify-between">
                            <div>
                                <label
                                    className="block mb-1.5 text-xs font-medium text-muted-foreground">
                                    Downloaded Data Range
                                </label>
                                {
                                    (dataRanges.minDate && dataRanges.effectiveMaxDate) && (
                                        <div
                                            className="font-medium text-foreground text-sm"
                                        >
                                            {format(dataRanges.minDate, 'yyyy-MM-dd')} - {format(dataRanges.effectiveMaxDate, 'yyyy-MM-dd HH:mm')}
                                        </div>
                                    )
                                }
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="secondary"
                                        className="h-full"
                                        onClick={async () => {
                                            setIsDbWorking(true);
                                            try {
                                                await db.fileManager.getState().loadRecentEvents();
                                            } finally {
                                                setIsDbWorking(false);
                                            }
                                        }}
                                    >
                                        <RefreshCw></RefreshCw>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    Refresh data
                                </TooltipContent>
                            </Tooltip>
                        </div>


                        <label
                            className="block mb-1.5 mt-3 text-xs font-medium text-muted-foreground">
                            Auto-Download Range
                        </label>
                        <AutoDownloadRangeSelector
                        ></AutoDownloadRangeSelector>

                        <div>
                        <label className="block mb-1.5 mt-3 text-xs font-medium text-muted-foreground">
                                Storage Consumption
                            </label>
                            <Tooltip defaultOpen={false}>
                                <TooltipTrigger>
                                    <div className="flex items-center text-sm gap-2">
                                        <span>
                                            ~{bytesToMegabytesBinary(storageConsumption)} MB
                                        </span>
                                        <Info width={14} height={14}></Info>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    This value is an assumption based on available data.
                                </TooltipContent>
                            </Tooltip>
                        </div>

                        {downloadOptions.length > 0 && <div>
                            <label className="block mb-1.5 mt-3 text-xs font-medium text-muted-foreground">
                                Download additional event data
                            </label>
                            <div className="flex flex-col gap-1 items-center justify-between text-sm">
                                {downloadOptions?.map((file) => (
                                    <Button
                                        key={file.name}
                                        className="self-stretch"
                                        variant="secondary"
                                        onClick={() => loadFiles(file.files)}
                                    >
                                        {format(file.start, 'yyyy-MM-dd')} - {format(file.end, 'yyyy-MM-dd')} ({Math.round(bytesToMegabytesBinary(file.accSize))}MB)
                                    </Button>
                                ))}
                            </div>
                        </div>}
                    </Card>
                </PopoverContent>
            </Popover>
        </div>
    )
}


const bytesToMegabytesBinary = (bytes: number, decimals: number = 2): number => {
    const megabytes = bytes / (1024 ** 2); // 1 MB = 1024 * 1024 bytes
    return parseFloat(megabytes.toFixed(decimals));
};
