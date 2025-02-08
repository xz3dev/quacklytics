import {Spinner} from "@/components/spinner.tsx";

export function DuckDBLoadingIndicator(props: { children: React.ReactNode }) {
    // const isLoading = useDuckDBStore(state => state.isLoading)
    const isLoading = false
    if (!isLoading) return props.children
    return (
        <div className="flex items-center justify-center">
            <Spinner />
        </div>
    )
}
