<script>
    import '../app.css'
    import {isLoadingEvents} from '$lib/parquet-manager'
    import NavBar from '$lib/components/navbar/NavBar.svelte'
</script>

<NavBar />
<div class="w-full h-full p-6">
  {#if $isLoadingEvents}
    <div class="flex items-center flex-col content-center h-full">
      <span class="loading loading-ring loading-lg m-auto"></span>
    </div>
  {:else}
    <slot />
  {/if}
</div>
