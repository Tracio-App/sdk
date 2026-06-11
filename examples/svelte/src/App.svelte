<script lang="ts">
  import { useTracioResult } from "@tracio/svelte";

  // `useTracioResult` is a Svelte store; access it with the `$` auto-subscription.
  const result = useTracioResult();
</script>

<main style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto">
  <h1>@tracio/svelte example</h1>

  {#if $result.isLoading}
    <p>Fingerprinting visitor…</p>
  {:else if $result.error}
    <p style="color: crimson">Error [{$result.error.code}]: {$result.error.message}</p>
  {:else if $result.data}
    <p>
      <span style="color: #71717a">Visitor ID</span><br />
      <code>{$result.data.visitorId}</code>
    </p>
    <p>
      <span style="color: #71717a">Bot result</span><br />
      {$result.data.bot.detected
        ? `bot detected (confidence ${$result.data.bot.confidence})`
        : "human"}
    </p>
    <pre style="background: #f4f4f5; padding: 1rem; border-radius: 0.5rem">{JSON.stringify(
        $result.data,
        null,
        2,
      )}</pre>
  {/if}
</main>
