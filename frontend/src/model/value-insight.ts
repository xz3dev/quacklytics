import {Insight} from "@/model/insight.ts";
import {Query} from "@lib/queries.ts";

export interface ValueInsight extends Insight {
    type: 'Value'
    series: ValueSeries[]
    config: ValueInsightConfig
}

export interface ValueSeries {
    query: Query
}

export const newValueInsight: Omit<ValueInsight, 'id'> = {
    type: 'Value',
    series: [
        {
            query: {
                filters: [],
                aggregations: [{
                    function: 'COUNT',
                    alias: 'result_value',
                    field: {
                        name: 'id',
                        type: 'string',
                    }
                }],
            }
        }
    ],
    config: {
        duration: 'P4W'
    },
    favorite: false,
}


export interface ValueInsightConfig {
    duration: string
}


export const ValueConfigEmpty: ValueInsightConfig = {
    duration: 'P4W',
}
