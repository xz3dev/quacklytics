<script lang="ts">
    import Check from "lucide-svelte/icons/check";
    import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
    import { tick } from "svelte";
    import * as Command from "$lib/components/ui/command/index.js";
    import * as Popover from "$lib/components/ui/popover/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { cn } from '$lib/components/utils'

    const projects = [
        {
            id: "default",
            name: "Default Project"
        },
        {
            id: "second",
            name: "Second Project"
        },
    ];

    let open = false;
    let value = "default";

    $: selectedValue =
        projects.find((f) => f.id === value)?.name ?? "Select a framework...";

    // We want to refocus the trigger button when the user selects
    // an item from the list so users can continue navigating the
    // rest of the form with the keyboard.
    function closeAndFocusTrigger(triggerId: string) {
        open = false;
        tick().then(() => {
            document.getElementById(triggerId)?.focus();
        });
    }
</script>

<Popover.Root bind:open let:ids>
  <Popover.Trigger asChild let:builder>
    <Button
      builders={[builder]}
      variant="outline"
      role="combobox"
      aria-expanded={open}
      class="w-[200px] justify-between"
    >
      {selectedValue}
      <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </Popover.Trigger>
  <Popover.Content class="w-[200px] p-0">
    <Command.Root>
      <Command.Input placeholder="Search Project..." />
      <Command.Empty>No Project found.</Command.Empty>
      <Command.Group>
        {#each projects as project}
          <Command.Item
            value={project.id}
            onSelect={(currentValue) => {
       value = currentValue;
       closeAndFocusTrigger(ids.trigger);
      }}
          >
            <Check
              class={cn(
        "mr-2 h-4 w-4",
        value !== project.id && "text-transparent"
       )}
            />
            {project.name}
          </Command.Item>
        {/each}
      </Command.Group>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
