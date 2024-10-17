<script lang="ts">
    import { page } from '$app/stores'
    import { isLoadingEvents } from '$lib/parquet-manager'

    type SidebarItem = {
        label: string;
        icon?: string;
        href?: string;
    };

    type SidebarSection = {
        items: SidebarItem[];
    };

    export let config: SidebarSection[] = [
        {
            items: [
                {
                    icon: 'icon-[tabler--list]',
                    label: 'Events',
                    href: '/events',
                },
                {
                    icon: 'icon-[tabler--filter-filled]',
                    label: 'Insights',
                    href: '/insight',
                },
            ],
        },
    ]
</script>

<nav class="flex flex-col items-stretch bg-base-200 w-64 h-full overflow-y-auto">
  {#each config as section}
    <div class="p-4">
      <ul class="space-y-2">
        {#each section.items as item}
          <li>
            <a
              href={item.href || '#'}
              class="btn btn-lg w-full flex items-center justify-start {$page.url.pathname === item.href ? 'btn-primary' : ''}"
            >
              {#if item.icon}
                <span class="{item.icon} h-5 w-5"></span>
              {/if}
              <span>{item.label}</span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
    <div class="divider"></div>
    <div class="flex-1"></div>
    <div
      class="flex items-center p-4 gap-2 h-20 font-bold text-sm
             {$isLoadingEvents ? 'bg-primary text-primary-content' : 'bg-neutral text-neutral-content'}"
    >
      {#if $isLoadingEvents}
        <span class="icon-[tabler--cloud-download] h-8 w-8"></span>
        Loading data...
      {:else}
        <span class="icon-[tabler--square-rounded-check-filled] h-8 w-8"></span>
        Data loaded
      {/if}
    </div>
  {/each}
</nav>
