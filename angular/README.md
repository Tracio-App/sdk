# @tracio/angular

Angular 17+ standalone provider + signals service for the Tracio bot detection SDK.

## Install

```bash
npm install @tracio/angular @tracio/sdk
```

(Angular 17, 18, 19, or 20 must be installed separately.)

## Quick start

```ts
// app.config.ts
import { provideTracio } from "@tracio/angular";

export const appConfig: ApplicationConfig = {
  providers: [provideTracio({ publicKey: "5ca175fc…" })],
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

`config` is the core [`TracioConfig`](https://www.npmjs.com/package/@tracio/sdk#tracioinitconfig-tracioconfig-tracioinstance) — every field (`publicKey`, `endpoint`, `linkedId`,
`linkedIdSig`, `tag`, `fields`, `timeoutMs`, …) is passed to the core as is; semantics and limits
are in the core README. It is read once, when `TracioService` is created; the instance is
destroyed with the injector that owns the service (`ngOnDestroy`). Keep `provideTracio()` in
the application providers: in a route's or component's providers, leaving that scope removes
the edge script, and coming back records a second visit within the same page load.

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

## Example

Runnable Vite + Angular app: [`../examples/angular`](../examples/angular).

## License

MIT
