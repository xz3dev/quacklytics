<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';
  import { authService } from '$lib/client/auth';

  let email = '';
  let password = '';
  let errors: { email?: string; password?: string } = {};
  let isSubmitting = false;

  $: isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  $: isValidPassword = (password: string) => {
    return password.length >= 6;
  };

  $: isFormValid = isValidEmail(email) && isValidPassword(password);

  function validateForm() {
    errors = {};
    if (!isValidEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!isValidPassword(password)) {
      errors.password = 'Password must be at least 6 characters long';
    }
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (validateForm()) {
      isSubmitting = true;
      try {
        await authService.login(email, password);
      } catch (error) {
        console.error('Login failed', error);
        alert('Login failed. Please try again.');
      } finally {
        isSubmitting = false;
      }
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100">
  <Card.Root class="w-full max-w-md">
    <Card.Header>
      <Card.Title class="text-2xl font-bold text-center">Login</Card.Title>
    </Card.Header>
    <Card.Content>
      <form on:submit|preventDefault={handleSubmit}>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              bind:value={email}
              aria-invalid={errors.email ? 'true' : undefined}
            />
            {#if errors.email}
              <p class="text-sm text-red-500">{errors.email}</p>
            {/if}
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              bind:value={password}
              aria-invalid={errors.password ? 'true' : undefined}
            />
            {#if errors.password}
              <p class="text-sm text-red-500">{errors.password}</p>
            {/if}
          </div>
        </div>
        <Button type="submit" class="w-full mt-6" disabled={!isFormValid || isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </Button>
      </form>
    </Card.Content>
    <Card.Footer class="text-center text-sm text-gray-600">
      Don't have an account? <a href="/auth/register" class="ml-2 text-blue-600 hover:underline"
        >Register</a
      >
    </Card.Footer>
  </Card.Root>
</div>
