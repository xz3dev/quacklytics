import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {useProjects, useUpdateAutoLoad} from "@/services/projects.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {Spinner} from "@/components/spinner.tsx";
import {useEffect, useState} from "react";

const ranges = ["3", "6", "12"] as const;

export function AutoDownloadRangeSelector() {
    const [autoload, setAutoload] = useState<string>(ranges[0])
    const projectId = useProjectId();
    const projects = useProjects()
    const project = projects.data?.find(p => p.id === projectId)
    const updater = useUpdateAutoLoad()

    if(!project) return (
        <Spinner></Spinner>
    )

    useEffect(() => {
        setAutoload(project.autoload.toString())
    }, [projects])

    return (
        <div>
            <Tabs value={autoload}>
                <TabsList className="w-full">
                    {ranges.map(range => (
                        <TabsTrigger
                            key={range}
                            value={range}
                            className="w-full"
                            onClick={() => {
                                updater.mutate({projectId, value: parseInt(range)})
                                setAutoload(range)
                            }}
                        >{range} Months</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    );
}
