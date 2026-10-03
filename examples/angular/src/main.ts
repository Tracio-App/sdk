import "zone.js";
import "@angular/compiler";
import { JsonPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideTracio, TracioService } from "@tracio/angular";

// ─── Edit this with your own public key ─────────────────────────────────────
// Find it in the Tracio dashboard under Settings → API keys.
const PUBLIC_KEY = "tracio_pk_555148989a564c2d6f876337141e9e586f9beb11";
const ENDPOINT = "https://edge.tracio.dev";
// ────────────────────────────────────────────────────────────────────────────

@Component({
  selector: "app-root",
  standalone: true,
  template: `
    <main style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto">
      <h1>&#64;tracio/angular example</h1>

      @if (tracio.error(); as err) {
        <p style="color: crimson">Error [{{ err.code }}]: {{ err.message }}</p>
      } @else if (tracio.result(); as result) {
        <p>
          <span style="color: #71717a">Visitor ID</span><br />
          <code>{{ result.visitorId }}</code>
        </p>
        <p>
          <span style="color: #71717a">Bot result</span><br />
          {{
            result.bot.detected
              ? "bot detected (confidence " + result.bot.confidence + ")"
              : "human"
          }}
        </p>
        <pre
          style="background: #f4f4f5; padding: 1rem; border-radius: 0.5rem"
        ><code>{{ result | json }}</code></pre>
      } @else {
        <p>Fingerprinting visitor…</p>
      }
    </main>
  `,
  imports: [JsonPipe],
})
export class App {
  // Three readonly signals: visitorId(), result(), error().
  readonly tracio = inject(TracioService);
}

bootstrapApplication(App, {
  providers: [provideTracio({ publicKey: PUBLIC_KEY, endpoint: ENDPOINT })],
}).catch((err) => console.error(err));
