<script>
    import '../app.css'
    import Sidebar from './Sidebar.svelte'
    import {isLoadingEvents} from '$lib/parquet-manager'
</script>

<div class="drawer lg:drawer-open">
  <input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content flex flex-col items-center justify-center">
    <div class="w-full h-full p-6">
      {#if $isLoadingEvents}
        <div class="flex items-center flex-col content-center h-full">
          <span class="loading loading-ring loading-lg m-auto"></span>
        </div>
      {:else}
        <slot />
      {/if}
    </div>
    <label for="my-drawer-2" class="btn btn-primary drawer-button lg:hidden">
      Open drawer
    </label>
  </div>
  <Sidebar />
</div>
