import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {useProjects, useUpdateAutoLoad} from "@/services/projects.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {Spinner} from "@/components/spinner.tsx";

const ranges = ["3", "6", "12"] as const;

export function AutoDownloadRangeSelector() {
    const projectId = useProjectId();
    const projects = useProjects()
    const project = projects.data?.find(p => p.id === projectId)
    const updater = useUpdateAutoLoad()

    if(!project) return (
        <Spinner></Spinner>
    )

    const autoload = project.autoload.toString()

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
                            }}
                        >{range} Months</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    );
}
