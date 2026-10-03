<script setup lang="ts">
import { useTracioResult } from "@tracio/vue";

// `useTracioResult` returns reactive refs: { data, isLoading, error }.
const { data, isLoading, error } = useTracioResult();
</script>

<template>
  <main style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto">
    <h1>@tracio/vue example</h1>

    <p v-if="isLoading">Fingerprinting visitor…</p>
    <p v-else-if="error" style="color: crimson">Error [{{ error.code }}]: {{ error.message }}</p>
    <template v-else-if="data">
      <p>
        <span style="color: #71717a">Visitor ID</span><br />
        <code>{{ data.visitorId }}</code>
      </p>
      <p>
        <span style="color: #71717a">Bot result</span><br />
        {{ data.bot.detected ? `bot detected (confidence ${data.bot.confidence})` : "human" }}
      </p>
      <pre style="background: #f4f4f5; padding: 1rem; border-radius: 0.5rem">{{
        JSON.stringify(data, null, 2)
      }}</pre>
    </template>
  </main>
</template>
