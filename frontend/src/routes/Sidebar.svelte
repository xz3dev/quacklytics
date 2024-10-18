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

<div class="drawer-side">
  <label for="my-drawer-2" aria-label="close sidebar" class="drawer-overlay"></label>
  <ul class="menu menu-lg bg-base-200 text-base-content min-h-full w-80 p-4">
    {#each config as section}
      {#each section.items as item}
        <li>
          <a
            href={item.href || '#'}
            class="{$page.url.pathname === item.href ? 'active' : ''}"
          >
            {#if item.icon}
              <span class="{item.icon}"></span>
            {/if}
            {item.label}
          </a>
        </li>
      {/each}
    {/each}
  <div
    class="flex items-center gap-2 p-4 mt-auto rounded-lg font-bold
               {$isLoadingEvents ? 'bg-info text-info-content' : 'bg-neutral text-neutral-content'}"
  >
    {#if $isLoadingEvents}
      <span class="loading loading-ring loading-md"></span>
      Loading data...
    {:else}
      <span class="icon-[tabler--square-rounded-check-filled] w-6 h-6"></span>
      Data loaded
    {/if}
  </div>
  </ul>
</div>
