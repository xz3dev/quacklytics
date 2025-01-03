import {UseQueryResult} from "@tanstack/react-query";
import React from "react";
import {Spinner} from "@/components/spinner.tsx";


export function renderQuery<T>(
    q: UseQueryResult<T, Error>,
    renderer: (data: T) => React.ReactNode,
    key?: string | number,
): React.ReactNode {
    if(q.isLoading || q.isPending) return <Spinner key={key}/>
    if(q.isError) return <div key={key}>Error: {q.error.message}</div>
    if(!q.data) return <div key={key}></div>
    return renderer(q.data)
}
