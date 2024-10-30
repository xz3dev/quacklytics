<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/stores';

$: if (!$page.data.user && !['login', 'register', 'forgot-password'].includes($page.url.pathname.split('/').pop())) {
    goto('/auth/login');
}
</script>


<slot />
