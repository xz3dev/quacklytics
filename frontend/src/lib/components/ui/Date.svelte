<script lang="ts">
  import moment from 'moment';
  export let date: Date | string | undefined;
</script>

{#if date}
  {moment(date).format('llll')}
{/if}
