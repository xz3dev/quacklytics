import React from 'react';
import {FunnelInsight, FunnelStep} from "@/model/insights/funnel-insights";
import {determineDateRange} from "@/model/insights/insight-date-range";
import {buildFunnelQuery} from "@lib/funnel-queries";
import {useDuckDBQuery} from "@/services/duck-db-queries";
import {useProjectId} from "@/hooks/use-project-id";
import {simpleHash} from "@lib/checksums";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Card, CardContent, CardHeader} from "@/components/ui/card.tsx";

interface FunnelInsightResultsProps {
    insight: FunnelInsight;
}

interface ProcessedStepData {
    stepConfig: FunnelStep | undefined;
    name: string;
    value: number;
    percentageOfFirst: number;
    percentageOfPrevious: number;
    dropOffFromPrevious: number;
    dropOffPercentageFromPrevious: number;
}

export function FunnelInsightResults({insight}: FunnelInsightResultsProps) {
    const projId = useProjectId();
    const conf = insight.config.funnel;
    const steps = conf.steps ?? [];

    if (steps.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">Funnel requires at least one step defined.</div>;
    }

    const timeFrame = determineDateRange(conf.duration ?? 'P30D');
    const q = buildFunnelQuery(steps, 'events', timeFrame.start, timeFrame.end);

    const results = useDuckDBQuery(
        projId,
        `funnel-${simpleHash(JSON.stringify(conf))}`,
        q,
    );

    const processedStepData: ProcessedStepData[] | undefined = React.useMemo(() => {
        if (results.isLoading || results.error || !results.data?.[0] || steps.length === 0) {
            return undefined;
        }

        const rawData = results.data[0];
        const stepEntries = Object.entries(rawData);

        if (stepEntries.length === 0) {
            return undefined;
        }

        const firstStepValue = Number(stepEntries[0][1]);

        if (isNaN(firstStepValue) || firstStepValue === 0) {
            return stepEntries.map(([, v], index) => ({
                stepConfig: steps[index],
                name: steps[index]?.name || `Step ${index + 1}`,
                value: Number(v) || 0,
                percentageOfFirst: 0,
                percentageOfPrevious: 0,
                dropOffFromPrevious: 0,
                dropOffPercentageFromPrevious: 0,
            }));
        }

        return stepEntries.map(([, v], index) => {
            const currentValue = Number(v) || 0;
            const previousValue = index > 0 ? Number(stepEntries[index - 1][1]) || 0 : currentValue;

            const percentageOfFirst = (currentValue / firstStepValue) * 100;
            const percentageOfPrevious = index > 0 && previousValue !== 0 ? (currentValue / previousValue) * 100 : 100;
            const dropOffFromPrevious = index > 0 ? previousValue - currentValue : 0;
            const dropOffPercentageFromPrevious = index > 0 && previousValue !== 0 ? (dropOffFromPrevious / previousValue) * 100 : 0;

            return {
                stepConfig: steps[index],
                name: steps[index]?.name || `Step ${index + 1}`,
                value: currentValue,
                percentageOfFirst: isNaN(percentageOfFirst) ? 0 : percentageOfFirst,
                percentageOfPrevious: isNaN(percentageOfPrevious) ? 0 : percentageOfPrevious,
                dropOffFromPrevious: isNaN(dropOffFromPrevious) ? 0 : dropOffFromPrevious,
                dropOffPercentageFromPrevious: isNaN(dropOffPercentageFromPrevious) ? 0 : dropOffPercentageFromPrevious,
            };
        });
    }, [results.data, results.isLoading, results.error, steps]);

    const overallConversionRate = processedStepData && processedStepData.length > 1
        ? processedStepData[processedStepData.length - 1].percentageOfFirst
        : (processedStepData?.length === 1 ? processedStepData[0].percentageOfFirst : 0);


    if (results.isLoading) {
        return <div className="p-4 text-center text-muted-foreground">Loading funnel data...</div>;
    }

    if (results.error) {
        console.error("Error loading funnel data:", results.error);
        return <div className="p-4 text-center text-red-600">Error loading funnel data. Please try again
            later.</div>;
    }

    if (!processedStepData || processedStepData.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">No funnel data available.</div>;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Funnel Visualization</h3>
                    <div className="text-sm text-muted-foreground">
                        <span>Total Conversion: {overallConversionRate.toFixed(2)}%</span>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className="flex space-x-2 md:space-x-4 items-baseline justify-center p-4 bg-muted rounded mb-6">
                    {processedStepData.map((step, index) => (
                        <div key={step.name || index} className="flex flex-col items-center text-center flex-1 min-w-0"
                             title={`Step ${index + 1}: ${step.name}`}>
                            <div
                                className="relative w-full h-48 bg-muted dark:bg-muted rounded-t-md overflow-hidden group">
                                <div
                                    className="absolute bottom-0 left-0 w-full rounded-lg bg-chart-1 transition-all duration-500 ease-out hover:opacity-80"
                                    style={{height: `${step.percentageOfFirst}%`}}
                                    title={`${step.percentageOfFirst.toFixed(1)}% of initial (${step.value} users)`}
                                >
                                    {step.percentageOfFirst > 15 && (
                                        <span
                                            className="absolute top-1 left-1/2 transform -translate-x-1/2 text-primary text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                            {step.percentageOfFirst.toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                                {step.percentageOfFirst <= 15 && (
                                    <span
                                        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-primary text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                        {step.percentageOfFirst.toFixed(0)}%
                                    </span>
                                )}
                            </div>

                            <div className="mt-2 w-full px-1">
                                <div className="text-sm font-medium text-foreground truncate" title={step.name}>
                                    {index + 1}. {step.name}
                                </div>
                                <div className="text-xs text-muted-foreground mt-2">
                                    {step.value} users ({step.percentageOfFirst.toFixed(1)}%)
                                </div>
                                {index > 0 && (
                                    <div className="text-xs text-muted-foreground mt-1"
                                         title={`Dropped from Step ${index}: ${step.dropOffFromPrevious} users (${step.dropOffPercentageFromPrevious.toFixed(1)}%)`}>
                                        -{step.dropOffFromPrevious} (-{step.dropOffPercentageFromPrevious.toFixed(1)}%)
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="overflow-x-auto mb-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2 px-1">Detailed Results</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-muted-foreground">Step Name</TableHead>
                                <TableHead className="text-muted-foreground text-right">Users</TableHead>
                                <TableHead className="text-muted-foreground text-right">% of First</TableHead>
                                <TableHead className="text-muted-foreground text-right">% Conv. (Prev)</TableHead>
                                <TableHead className="text-muted-foreground text-right">Drop-off (Prev)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processedStepData.map((step, index) => (
                                <TableRow key={index} className="hover:bg-muted">
                                    <TableCell
                                        className="font-medium text-foreground">{index + 1}. {step.name}</TableCell>
                                    <TableCell className="text-muted-foreground text-right">{step.value}</TableCell>
                                    <TableCell
                                        className="text-muted-foreground text-right">{step.percentageOfFirst.toFixed(2)}%</TableCell>
                                    <TableCell
                                        className="text-muted-foreground text-right">{index === 0 ? '-' : `${step.percentageOfPrevious.toFixed(2)}%`}</TableCell>
                                    <TableCell
                                        className="text-muted-foreground text-right">{index === 0 ? '-' : `${step.dropOffFromPrevious} (${step.dropOffPercentageFromPrevious.toFixed(2)}%)`}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

        </Card>
    );
}
