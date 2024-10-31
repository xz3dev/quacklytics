<script>
    import ProjectSwitcher from '$lib/components/navbar/project-switcher/ProjectSwitcher.svelte'
    import Profile from '$lib/components/navbar/Profile.svelte'
</script>

<div class="flex h-16 px-4 items-center gap-4 border-b">
  <ProjectSwitcher />

  <nav class="flex flex-1 items-center gap-2 text-muted-foreground text-sm font-medium transition-colors">
    <a
      href="/app/events" class="hover:text-primary"
    >
      Events
    </a>
    <a
      href="/app/insight" class="hover:text-primary"
    >
      Insights
    </a>
  </nav>
  <div class="flex flex-1 items-center justify-end">
    <Profile />
  </div>
</div>
