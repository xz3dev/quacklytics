import {Outlet} from "react-router";
import {Button} from "@/components/ui/button.tsx";

export function Home() {
    return (
        <>
            <div className="flex flex-col gap-2 ">
                <Button variant="destructive">Test</Button>
                <Button variant="outline">Test</Button>
            </div>
            <Outlet/>
        </>
    )
}
