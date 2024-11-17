<script lang="ts">
import { Button } from '$lib/components/ui/button'
import * as Popover from '$lib/components/ui/popover'
import { Trash2 } from 'lucide-svelte'
import { DotsHorizontal } from 'svelte-radix'

export let rowIndex: number
export let openMenu: number | undefined

function handleOpenChange(open: boolean) {
    console.log('hi')
    openMenu = open ? rowIndex : undefined
}
</script>

<Popover.Root open={openMenu === rowIndex} onOpenChange={handleOpenChange}>
    <Popover.Trigger>
        <Button variant="ghost" size="icon">
            <DotsHorizontal class="h-4 w-4" />
        </Button>
    </Popover.Trigger>
    <Popover.Content
        class="w-[var(--radix-popover-trigger-width)] p-0"
        side="bottom"
        align="end"
        alignOffset={0}
        sideOffset={5}
    >
        <div class="bg-background shadow-md rounded-md flex flex-col overflow-hidden">
            <Button variant="destructive" class="rounded-none">
                <Trash2 class="h-4 w-4 mr-1" />
                Delete
            </Button>
        </div>
    </Popover.Content>
</Popover.Root>
