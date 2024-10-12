<script>
    import "../app.css";
    import Sidebar from './Sidebar.svelte'
</script>

<div class="flex flex-row h-screen">
  <div class="items-stretch h-full">
    <Sidebar />
  </div>
  <div class="flex-1 p-6">
    <slot />
  </div>
</div>
