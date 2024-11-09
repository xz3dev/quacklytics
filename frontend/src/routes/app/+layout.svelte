<script lang="ts">
  import AuthRoute from '$lib/components/AuthRoute.svelte';
  import NavBar from '$lib/components/navbar/NavBar.svelte';
  import { isLoadingEvents } from '$lib/parquet-manager';
  import Spinner from '$lib/components/ui/spinner/Spinner.svelte';
</script>

<AuthRoute>
  <NavBar />
  <div class="w-full h-full p-6">
    {#if $isLoadingEvents}
      <div class="flex items-center flex-col content-center h-full gap-2">
        <div class="text-muted-foreground text-sm">Loading data...</div>
        <Spinner />
      </div>
    {:else}
      <slot />
    {/if}
  </div>
</AuthRoute>
