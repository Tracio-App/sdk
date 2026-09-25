import { mount } from "svelte";
import { Tracio } from "@tracio/svelte";
import App from "./App.svelte";

// ─── Edit this with your own public key ─────────────────────────────────────
// Find it in the Tracio dashboard under Settings → API keys.
const PUBLIC_KEY = "tracio_pk_555148989a564c2d6f876337141e9e586f9beb11";
const ENDPOINT = "https://edge.tracio.dev";
// ────────────────────────────────────────────────────────────────────────────

// Bootstrap the singleton once, on app boot (client-side only).
// In SvelteKit, wrap this in `if (browser)` from `$app/environment`.
Tracio.init({ publicKey: PUBLIC_KEY, endpoint: ENDPOINT });

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
