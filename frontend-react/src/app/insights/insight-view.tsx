import {useParams} from "react-router";

export function InsightView() {
    const { insightid } = useParams();
    return (
        <div>ID: {insightid}</div>
    )
}
