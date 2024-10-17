<script>
    import '../app.css'
    import Sidebar from './Sidebar.svelte'
    import {isLoadingEvents} from '$lib/parquet-manager'
</script>

<div class="flex flex-row h-screen">
  <div class="items-stretch h-full">
    <Sidebar />
  </div>
  <div class="flex-1 p-6">
    {#if $isLoadingEvents}
      ...loading
    {:else}
      <slot />
    {/if}
  </div>
</div>
