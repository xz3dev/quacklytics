import {Insight} from "@/model/insights/insight.ts";


export interface Dashboard {
    id: number;
    name: string
    createdAt?: string;
    updatedAt?: string;
    favorite: boolean
    home: boolean
    insights: Insight[]
}

export interface DashboardInput {
    name: string
    favorite: boolean
}
