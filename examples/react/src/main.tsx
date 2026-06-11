import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TracioProvider, useTracioResult } from "@tracio/react";

// ─── Edit this with your own public key ─────────────────────────────────────
// Find it in the Tracio dashboard under Settings → API keys.
const PUBLIC_KEY = "tracio_pk_555148989a564c2d6f876337141e9e586f9beb11";
const ENDPOINT = "https://edge.tracio.dev";
// ────────────────────────────────────────────────────────────────────────────

function VisitorCard() {
  // `useTracioResult` returns the full result reactively: { data, isLoading, error }.
  const { data, isLoading, error } = useTracioResult();

  if (isLoading) return <p>Fingerprinting visitor…</p>;
  if (error) return <p style={{ color: "crimson" }}>Error [{error.code}]: {error.message}</p>;
  if (!data) return <p>No result.</p>;

  return (
    <div>
      <p>
        <span style={{ color: "#71717a" }}>Visitor ID</span>
        <br />
        <code>{data.visitorId}</code>
      </p>
      <p>
        <span style={{ color: "#71717a" }}>Bot result</span>
        <br />
        {data.bot.detected ? `bot detected (confidence ${data.bot.confidence})` : "human"}
      </p>
      <pre style={{ background: "#f4f4f5", padding: "1rem", borderRadius: "0.5rem" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: "40rem", margin: "3rem auto" }}>
      <h1>@tracio/react example</h1>
      <TracioProvider config={{ publicKey: PUBLIC_KEY, endpoint: ENDPOINT }}>
        <VisitorCard />
      </TracioProvider>
    </main>
  </StrictMode>,
);
