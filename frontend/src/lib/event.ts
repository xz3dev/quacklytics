export interface AnalyticsEvent {
    id: string
    timestamp: Date
    eventType: string
    userId: string
    properties: Record<string, any>
}
