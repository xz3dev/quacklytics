import {Link, useNavigate} from "react-router";
import {useProjects} from "@/services/projects.ts";
import {Spinner} from "@/components/spinner.tsx";
import {useEffect} from "react";

export function ProjectsList() {
    const projects = useProjects()
    const navigator = useNavigate()
    if (projects.isPending || projects.isLoading) return <Spinner></Spinner>
    if (projects.isError) return <div>Error: {projects.error.message}</div>

    useEffect(() => {
        if(projects.data.length === 1){
            navigator(`/app/${projects.data[0].id}`)
        }
    }, [projects]);

    return (
        <div className="flex flex-col gap-2 place-content-center w-screen h-screen items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-widest mb-8">Jump to Project: </h1>
            {projects.data.map(p => (
                    <Link
                        key={p.id}
                        to={`/app/${p.id}`}
                    >
                        <div className="font-bold px-8 py-4 rounded-md bg-muted/65 hover:bg-muted">
                            {p.name ?? p.id}
                        </div>
                    </Link>
                )
            )}
        </div>
    )
}
