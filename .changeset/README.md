# Changesets

Add a changeset for any user-visible change to a public package:

```bash
pnpm changeset
```

Pick affected packages, choose bump level (patch/minor/major), describe the change.

The base branch is `development` (the dev mainline). Releases are **not** auto-generated:
a release is cut manually from `master` via the `sdk-release` Bitbucket pipeline, which runs
`changeset version` (bump + CHANGELOGs), pushes a `v<version>` tag, and mirrors `packages/`
to GitHub where `publish.yml` publishes to npm.

Lock-step: all five public packages are versioned together (`fixed` config). Bump one → bump all.

## Почему peer-диапазон на ядро — не `workspace:^`

Обёртки держат `@tracio/sdk` в `peerDependencies` (один экземпляр ядра на
приложение — реестр инстансов лежит на `globalThis`, вторая копия сломала бы
singleton). У changesets на этой связке есть правило: если пакет зависит от
бампающегося **через peerDependencies**, зависимый получает **major**. Оно
живёт в `shouldBumpMajor` и по умолчанию срабатывает _всегда_, потому что
`onlyUpdatePeerDependentsWhenOutOfRange` равно `false`.

Дальше вступает `fixed`-группа: она берёт наибольший тип релиза и разносит его
на все пять пакетов. Итог — один `minor`-changeset на ядро превращал весь набор
в major.

Так 17.09.2026 вместо `0.2.0` вышла `1.0.0`: релиз собрался, тег ушёл, и
поймано это было уже после. Публикация в npm тогда не состоялась по другой
причине (права токена), иначе номер занялся бы навсегда.

Поэтому здесь два связанных решения, и они работают **только вместе**:

1. `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.onlyUpdatePeerDependentsWhenOutOfRange: true`
   в `config.json` — major зависимым только когда новая версия ядра реально
   выходит за объявленный диапазон.
2. Peer-диапазон `workspace:>=0.1.4 <1.0.0` вместо `workspace:^`. Для версий
   `0.x` каретка означает `>=0.1.4 <0.2.0`, то есть **любой** minor ядра
   выходит за неё — и пункт 1 сам по себе ничего бы не дал.

Проверено прогоном `changeset version` на состоянии до релиза: с одним только
пунктом 1 выходит `1.0.0`, с обоими — `0.2.0`.

Границы честны: обёртки используют из ядра лишь `Tracio`, `TracioError`,
`isTracioError`, `isRetryableError` и типы — всё это есть с `0.1.4`.

**Когда набор перейдёт на `1.x`**, верхнюю границу нужно поднять (или вернуть
`workspace:^`, которая на `1.x` уже покрывает minor штатно). Оставленная как
есть, она отрежет обёртки от ядра после первого же мажора.
