import { createApp } from "vue";
import { TracioPlugin } from "@tracio/vue";
import App from "./App.vue";

// ─── Edit this with your own public key ─────────────────────────────────────
// Find it in the Tracio dashboard under Settings → API keys.
const PUBLIC_KEY = "tracio_pk_555148989a564c2d6f876337141e9e586f9beb11";
const ENDPOINT = "https://edge.tracio.dev";
// ────────────────────────────────────────────────────────────────────────────

createApp(App).use(TracioPlugin, { publicKey: PUBLIC_KEY, endpoint: ENDPOINT }).mount("#app");
