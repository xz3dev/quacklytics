import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input.tsx";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useProjects, useUpdateProjectCorsOrigins, useUpdateProjectName} from "@/services/projects.ts";
import {Spinner} from "@/components/spinner";
import {ApikeyManagement} from "@app/apikeys/apikey-management.tsx";
import {toast} from "sonner";
import {Textarea} from "@/components/ui/textarea.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {Globe2, Save, ShieldCheck} from "lucide-react";
import {useEffect, useMemo, useState} from "react";

export default function Settings() {
    const projectId = useProjectId()
    const projects = useProjects()
    const updater = useUpdateProjectName()
    const corsUpdater = useUpdateProjectCorsOrigins()
    const [projectName, setProjectName] = useState("")
    const [corsOrigins, setCorsOrigins] = useState("")
    const project = projects.data?.find(project => project.id === projectId)
    const savedCorsOrigins = useMemo(() => project?.corsOrigins.join("\n") ?? "", [project?.corsOrigins])

    useEffect(() => {
        if (!project) return
        setProjectName(project.name)
        setCorsOrigins(savedCorsOrigins)
    }, [project, savedCorsOrigins])

    const handleProjectNameChange = async () => {
        await updater.mutateAsync({projectId, value: projectName})
        toast.success("Project name updated!")
    };

    const handleCorsOriginsChange = async () => {
        await corsUpdater.mutateAsync({projectId, value: corsOrigins})
        toast.success("Allowed ingestion origins updated!")
    };

    if (projects.isLoading || projects.isPending) {
        return <Spinner></Spinner>
    }

    if (projects.isError) {
        return <div>Error: {projects.error.message}</div>
    }

    if (!project) {
        return <div>Project not found</div>
    }

    return (
        <div className="max-w-4xl space-y-10">
            <section className="space-y-4 border-b pb-8">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-muted-foreground"/>
                    <h2 className="text-xl font-semibold">Project</h2>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="project-name">Project name</Label>
                    <Input
                        className="max-w-xl"
                        type="text"
                        value={projectName}
                        id="project-name"
                        onChange={(event) => setProjectName(event.target.value)}
                    />
                </div>
                <Button
                    className="gap-2"
                    onClick={handleProjectNameChange}
                    disabled={updater.isPending || projectName === project.name}
                >
                    <Save className="h-4 w-4"/>
                    Save
                </Button>
            </section>

            <section className="space-y-4 border-b pb-8">
                <div className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5 text-muted-foreground"/>
                    <h2 className="text-xl font-semibold">Ingestion CORS</h2>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cors-origins">Allowed origins</Label>
                    <Textarea
                        id="cors-origins"
                        className="min-h-36 max-w-2xl font-mono text-sm"
                        placeholder={"http://localhost:3002\nhttps://app.example.com"}
                        value={corsOrigins}
                        onChange={(event) => setCorsOrigins(event.target.value)}
                    />
                </div>
                {project.corsOrigins.length > 0 && (
                    <div className="flex max-w-2xl flex-wrap gap-2">
                        {project.corsOrigins.map((origin) => (
                            <Badge key={origin} variant="secondary" className="font-mono">
                                {origin}
                            </Badge>
                        ))}
                    </div>
                )}
                <Button
                    className="gap-2"
                    onClick={handleCorsOriginsChange}
                    disabled={corsUpdater.isPending || corsOrigins === savedCorsOrigins}
                >
                    <Save className="h-4 w-4"/>
                    Save origins
                </Button>
            </section>

            <ApikeyManagement/>
        </div>
    );
}
