import {InsightsList} from "../insights/insight-list";

export function Home() {
    return (
        <InsightsList
            title={"Favorite Insights"}
            filter={(i) => i.favorite}
        />
    )
}
