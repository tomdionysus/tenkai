# Logger

`lib/Logger.js`

Console logging with levels and printf-style formatting (through `sprintf-js`). Each line is prefixed
with an ISO timestamp and the level.

```js
import { Logger } from 'tenkai'

var log = new Logger({ logLevel: 'info' })
log.info('Loaded %d cards in %.1fs', 309, 1.24)
// 2026-10-09T10:15:00.000Z [INFO] Loaded 309 cards in 1.2s
log.debug('not shown at info level')
```

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `logLevel` | `Logger.Warn` | The lowest level to log: a number, or `'debug'`, `'info'`, `'warn'` or `'error'`. |

## Levels

| Constant | Value |
|----------|-------|
| `Logger.Debug` | 0 |
| `Logger.Info` | 1 |
| `Logger.Warn` | 2 |
| `Logger.Error` | 3 |

Messages at or above `logLevel` are logged. Errors are always logged, through `console.error`; everything
else goes through `console.log`.

## Methods

### `debug(format, ...args)` / `info(...)` / `warn(...)` / `error(...)`

Logs at that level. `format` uses `sprintf` placeholders such as `%s`, `%d` and `%j`.

### `log(type, args)`

Logs `args` (an array: a format string, then its values) with the label `type`, whatever the level.

### `Logger.stringToLogLevel(str)`

Converts `'debug'`, `'info'`, `'warn'` or `'error'`, in any case, to its number, or `-1` if unknown. A level
of `-1` logs everything.

### `Logger.logLevelToString(level)`

Converts a number to its name, or `'unknown'`.

### `Logger.getDefaultLogger()`

A shared Logger at the default level, created on first use.
