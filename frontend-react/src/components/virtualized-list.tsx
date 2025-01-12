import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

interface VirtualizedListProps<T> {
    items: T[]
    renderItem: (item: T) => React.ReactNode
    itemHeight: number
}

export function VirtualizedList<T>({ items, renderItem, itemHeight }: VirtualizedListProps<T>) {
    const parentRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => itemHeight,
    })

    return (
        <div ref={parentRef} className="h-full overflow-auto">
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                        key={virtualRow.index}
                        style={{
                            position: 'absolute',
                            top: 0,
                            transform: `translateY(${virtualRow.start}px)`,
                            width: '100%',
                        }}
                    >
                        {renderItem(items[virtualRow.index])}
                    </div>
                ))}
            </div>
        </div>
    )
}
