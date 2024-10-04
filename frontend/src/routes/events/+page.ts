import type { PageLoad } from './$types'


export const load: PageLoad = ({ params }) => {
    return {
        events: [
            { id: 1, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
            { id: 2, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
            { id: 3, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
            { id: 4, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
            { id: 5, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
            { id: 6, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
            { id: 7, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
            { id: 8, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
            { id: 9, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
            { id: 10, timestamp: new Date(), eventType: 'pageview', userId: '123', properties: { foo: 'bar' } },
        ]
    }
}
