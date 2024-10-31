<script lang="ts">
    import { authService, authStore } from '$lib/client/auth'
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
    import { LogOut, User } from 'lucide-svelte'
    import { Button } from '$lib/components/ui/button'

    async function handleLogout() {
        try {
            await authService.logout()
        } catch (error) {
            console.error('Logout failed:', error)
        }
    }

    $: initials = $authStore?.email
        ? $authStore.email.charAt(0).toUpperCase()
        : '?'
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild let:builder>
    <Button
      builders={[builder]}
      variant="ghost"
      size="icon"
      class="relative h-8 w-8 rounded-full"
    >
      <div class="flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground">
        <span class="text-sm font-medium">
            {initials}
        </span>
      </div>
    </Button>
  </DropdownMenu.Trigger>

  <DropdownMenu.Content class="w-56" align="end">
    {#if $authStore?.email}
      <div class="flex items-center justify-start gap-2 p-2">
        <div class="flex flex-col space-y-1 leading-none">
          <p class="text-muted-foreground text-xs">{$authStore.email}</p>
        </div>
      </div>
      <DropdownMenu.Separator />
    {/if}
    <DropdownMenu.Item class="cursor-pointer" on:click={handleLogout}>
      <LogOut class="mr-2 h-4 w-4" />
      <span>Log out</span>
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
  :global(.dark) .dark\:text-white {
    color : white;
  }
</style>
