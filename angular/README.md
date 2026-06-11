# @tracio/angular

Angular 17+ standalone provider + signals service for the Tracio bot detection SDK.

## Install

```bash
npm install @tracio/angular @tracio/sdk
```

(Angular 17, 18, or 19 must be installed separately.)

## Quick start

```ts
// app.config.ts
import { provideTracio } from "@tracio/angular";

export const appConfig: ApplicationConfig = {
  providers: [provideTracio({ publicKey: "tracio_pk_…" })],
};
```

```ts
// home.component.ts
import { Component, inject } from "@angular/core";
import { TracioService } from "@tracio/angular";

@Component({ selector: "app-home", template: `<span>{{ tracio.visitorId() }}</span>` })
export class HomeComponent {
  readonly tracio = inject(TracioService);
}
```

## API

### `provideTracio(config: TracioConfig): Provider[]`

Returns an array of providers. Spread into your `ApplicationConfig.providers`.

### `TracioService` (injected)

Four readonly signals:

| Signal      | Type                           | Description                     |
| ----------- | ------------------------------ | ------------------------------- |
| `visitorId` | `Signal<string \| null>`       | UUID once loaded                |
| `result`    | `Signal<TracioResult \| null>` | Full result with bot info       |
| `error`     | `Signal<TracioError \| null>`  | Set if fetch failed             |
| `isLoading` | `Signal<boolean>`              | True while a fetch is in flight |

Plus `getVisitorData(): Promise<TracioResult | null>` to imperatively (re)fetch
— the service already fetches once in its constructor on the browser.

## SSR

`TracioService` constructor checks `isPlatformBrowser`. On server (Angular Universal), all signals stay `null` — the script never mounts.

`provideTracioServerRendering()` is intentionally **not** exported — fingerprinting must run client-side.

## License

MIT
