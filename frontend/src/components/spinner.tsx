import {Loader2} from "lucide-react";
import {cn} from "@lib/utils/tailwind.ts";

type Props = {
    size?: 'small' | 'medium' | 'large'
}

const sizes = {
    small: 'h-4 w-4',
    medium: 'h-6 w-6',
    large: 'h-8 w-8',
}

export function Spinner({size}: Props) {
    return (
        <Loader2
            className={cn('animate-spin', sizes[size ?? 'medium'])}
        />
    )
}
