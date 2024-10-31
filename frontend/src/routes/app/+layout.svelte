<script lang="ts">

import AuthRoute from '$lib/components/AuthRoute.svelte'
import NavBar from '$lib/components/navbar/NavBar.svelte'
import { isLoadingEvents } from '$lib/parquet-manager'
</script>

<AuthRoute>
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

</AuthRoute>
