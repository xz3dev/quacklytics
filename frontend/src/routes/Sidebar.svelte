<script lang="ts">
    import { page } from '$app/stores'
    import Icon from '@iconify/svelte'

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
                    label: 'Events',
                    href: '/events',
                },
                {
                    label: 'Insights',
                    href: '/insight',
                },
                {
                    label: 'Parquet Checksum',
                    href: '/events/parquet/checksums',
                },
            ],
        },
    ]
</script>

<nav class="bg-base-200 w-64 h-full overflow-y-auto">
  {#each config as section}
    <div class="p-4">
      <ul class="space-y-2">
        {#each section.items as item}
          <li>
            <a
              href={item.href || '#'}
              class="flex items-center p-2 rounded-lg hover:bg-base-300 transition-colors duration-200 {$page.url.pathname === item.href ? 'bg-primary text-primary-content' : 'text-base-content'}"
            >
              {#if item.icon}
                <Icon icon={item.icon} class="w-5 h-5 mr-2" />
              {/if}
              <span>{item.label}</span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
    <div class="divider"></div>
  {/each}
</nav>
