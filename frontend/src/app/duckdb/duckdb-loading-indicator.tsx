import {Spinner} from "@/components/spinner.tsx";

export function DuckDBLoadingIndicator(props: { isLoading: boolean, children: React.ReactNode }) {
    if (!props.isLoading) return props.children
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <Spinner />
            <div className="font-medium text-sm">Loading Data...</div>
        </div>
    )
}
