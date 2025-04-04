import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input.tsx";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useProjects, useUpdateProjectName} from "@/services/projects.ts";
import {Spinner} from "@/components/spinner";
import {ApikeyManagement} from "@app/apikeys/apikey-management.tsx";
import {toast} from "sonner";

export default function Settings() {
    const projectId = useProjectId()
    const projects = useProjects()
    const updater = useUpdateProjectName()

    if (projects.isLoading || projects.isPending) {
        return <Spinner></Spinner>
    }

    if (projects.isError) {
        return <div>Error: {projects.error.message}</div>
    }

    const project = projects.data?.find(project => project.id === projectId)

    if (!project) {
        return <div>Project not found</div>
    }



    const handleProjectNameChange = async () => {
        await updater.mutateAsync({projectId, value: (document.getElementById("project-name") as HTMLInputElement).value})
        toast.success("Project name updated!")
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold">Project Name</h2>
            <Input
                className="w-full"
                type="text"
                defaultValue={project.name}
                id="project-name"
            />
            <Button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={handleProjectNameChange}>
                Save
            </Button>
            <div className="h-8"></div>
            <ApikeyManagement/>
        </div>
    );
}
