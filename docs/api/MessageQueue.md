# MessageQueue

`lib/MessageQueue.js`

The messages of a modal message box: one shows at a time, others wait behind it in turn, and each stays at least
`hold` steps before a click can dismiss it, so a click meant for the game does not dismiss a message that has just
appeared. What a message is and how the box draws it are the game's: show it on a [Screen](Screen.md) that is
`modal` while a message shows.

```js
const hints = new MessageQueue({ hold: 30 })
if (hints.show({ text: 'Build a refinery.', picture: 63 }, () => tutorial.next())) game.showScreen(hintBox)
// each step:
hints.step()
// a click on the box:
if (hints.dismiss() && !hints.open) game.hideScreen(hintBox)
```

| Member | |
|---|---|
| `new MessageQueue({ hold })` | steps a message shows before it can be dismissed (default 0) |
| `show(message, closed)` | shows it, or queues it behind the one showing; true when it shows now; `closed()` is called when it is dismissed |
| `step()` | one step of holding |
| `dismiss()` | the message showing goes if held long enough, and the next shows; true when one went |
| `current`, `open`, `ready` | the message showing (or null); whether one shows; whether it can be dismissed |
| `clear()` | forget every message without calling `closed` |
