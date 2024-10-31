<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { authService, authStore } from '$lib/client/auth'

    export let fallback = '/auth/login';

    let isLoading = true;

    onMount(async () => {
        if (!$authStore) {
            await authService.checkAuth();
        }
        isLoading = false;
    });

    $: if (!isLoading && !$authStore) {
        // console.log($authStore, isLoading)
        goto(fallback);
    }

    $: console.log($authStore)
</script>

{#if isLoading}
  <p>Loading...</p>
{:else if $authStore}
  <slot />
{/if}
