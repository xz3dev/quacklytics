import {useState} from "react";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";

const ranges = ["3", "6", "12"] as const;
type Range = typeof ranges[number];

export function AutoDownloadRangeSelector() {
    const [, setDownloadRange] = useState<Range>("6");

    return (
        <div>
            <Tabs defaultValue="6" onValueChange={(newval) => setDownloadRange(newval as Range)}>
                <TabsList className="w-full">
                    {ranges.map(range => (
                        <TabsTrigger key={range} value={range} className="w-full">{range} Months</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    )
        ;
}
