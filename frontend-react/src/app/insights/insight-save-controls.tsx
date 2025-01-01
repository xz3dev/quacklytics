import {Button} from "@/components/ui/button.tsx";

interface Props {
    save: () => void
    discard: () => void
}

export function InsightSaveControls({save, discard}: Props) {
    return (
        <>
            <div className="flex items-center justify-end gap-2">
                <Button onClick={save}>Save</Button>
                <Button onClick={discard} variant="outline">Discard</Button>
            </div>
        </>
    )
}
