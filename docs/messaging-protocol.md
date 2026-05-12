# Inter-Frame Messaging Protocol

The parent window (`state.js`) and child iframe pages (`children.js`) communicate exclusively via `window.postMessage`. This document describes the wire format, handshake sequence, message types, and the three-layer security model.

---

## Architecture

The lesson shell opens each page inside an iframe. The shell ("parent") controls navigation, persistence, and LMS reporting. The page content ("child") handles rendering, user interaction, and event reporting. All cross-frame data flows through `postMessage`.

```
┌──────────────────────────────────────────────────┐
│  Parent (state.js)                               │
│  window.addEventListener("message", handleMessage)│
│                                                   │
│  ┌──────────────────────┐  ┌──────────────────┐  │
│  │  origin check         │  │  code check      │  │
│  │  (same origin only)   │  │  (pageAPISecret)  │  │
│  └────────┬─────────────┘  └───────┬──────────┘  │
│           ▼                        ▼               │
│  ┌──────────────────────────────────────────┐      │
│  │  nonce check (timestamp + dedup)         │      │
│  └──────────────────────────────────────────┘      │
│           ▼                                        │
│  ┌──────────────────────────────────────────┐      │
│  │  message dispatch by type                │      │
│  │  (QUIZ_RESULT, GET_QUIZ_DATA, PONG, ...) │      │
│  └──────────────────────────────────────────┘      │
└──────────────────────────────────────────────────┘
           ▲ postMessage                     │
           │                                 │
  ┌────────┴─────────────────────────────────▼────────┐
  │  Child (children.js)                              │
  │                                                    │
  │  send(subject, body, id)                           │
  │    → postMessage({type, message, code, nonce, id}) │
  │                                                    │
  │  receive(event)                                    │
  │    → dispatches events on window                   │
  │                                                    │
  │  _lastSent: cached for NONCE_REJECTED retry        │
  └────────────────────────────────────────────────────┘
```

---

## Handshake

Every child frame must establish identity before any other messages are accepted. This prevents pre-handshake injection.

### Sequence

```
Child                           Parent
  │                               │
  ├── ORIGIN (message="") ──────► │  (sent to "*")
  │     (no code, no nonce)       │
  │                               ├── verify origin matches window.location.origin
  │                               ├── generate pageAPISecret (random string)
  │◄── ORIGIN (message=origin, ───┤
  │     code=pageAPISecret)       │
  │                               │
  ├── handShake() receives        │
  │     stores parentOrigin       │
  │     stores pageAPICode        │
  │     calls setup()             │
  │                               │
  ├── SEND_META ─────────────────►│  (now with code + nonce)
  │     ...                       │
```

- The child sends the first `ORIGIN` to `"*"` (parent origin unknown at bootstrap).
- The parent responds with its origin and a fresh `pageAPISecret` code.
- The child locks in the parent origin and the secret code.
- All subsequent messages include the code and a nonce.
- The `ORIGIN` type is the only message that bypasses code and nonce checks.

---

## Message Wire Format

### Child → Parent

Every message from the child carries these top-level fields:

```js
{
    type: "QUIZ_RESULT",       // string message type
    message: { ... },          // payload (string or object)
    code: "aB3xK9...",         // pageAPISecret (set after handshake)
    nonce: 1776000000000,      // Date.now() — replay protection
    id: "quiz-component-1"     // optional, targeted component ID
}
```

### Parent → Child

The parent sends messages for data responses and control signals:

```js
{
    type: "QUIZ_DATA",         // string message type
    message: { id, value },    // payload (often wrapped { id, value })
    code: "aB3xK9...",        // pageAPISecret
}
```

### Wrapped Packet Convention

Many messages use an `{ id, value }` wrapper inside the `message` field to target a specific component:

```js
// Child sends
{
    type: "QUIZ_RESULT",
    message: {
        id: "quiz-1",          // component ID
        value: {
            score: 90,
            maxScore: 100,
            answers: { q1: ["A"] }
        }
    },
    code: "...",
    nonce: 1776000000000
}

// Parent unwraps: componentID = "quiz-1", msgData = { score: 90, ... }
```

The parent's `handleMessage()` detects this wrapper by checking `msgData && typeof msgData === "object" && "id" in msgData && "value" in msgData` and unpacks it automatically.

---

## Security Layers

Messages pass through three ordered security checks in `state.handleMessage()` before any processing occurs.

```
┌─────────────────────────────────────────────┐
│  Layer 1: Origin Check                      │
│  event.origin === window.location.origin     │
│  Rejects cross-origin messages with:        │
│    "Unknown message sender!"                │
├─────────────────────────────────────────────┤
│  Layer 2: Code Validation                   │
│  (skipped for ORIGIN type)                  │
│  event.data.code === pageAPISecret           │
│  Rejects invalid/missing codes with:        │
│    "Invalid code"                           │
│  Rejects pre-handshake messages with:       │
│    "Message received before handshake"      │
├─────────────────────────────────────────────┤
│  Layer 3: Nonce Validation                  │
│  (skipped for ORIGIN type)                  │
│  event.data.nonce must be a number          │
│  |now - nonce| <= 5 minutes                 │
│  nonce must not be in Seen Set              │
│  Rejects with NONCE_REJECTED reply:         │
│    "Invalid or expired nonce"               │
│    "Duplicate nonce"                        │
└─────────────────────────────────────────────┘
```

---

## Layer 3: Nonce Replay Protection

### Motivation

A captured postMessage with a valid origin and valid code can be replayed by an attacker to duplicate quiz submissions, inflate scores, or corrupt state. Nonces make each message unique and time-bound, so captured messages cannot be reused.

### Child: Nonce Generation (`children.js:send`)

```js
send: function(subject, body, id = null, backoff = 0) {
    // Pre-handshake queue: set _lastSent so NONCE_REJECTED retry works
    if (!this.pageAPICode || this.pageAPICode === "*") {
        this.messageQueue.push([subject, body, id]);
        this._lastSent = { subject, body, id, nonce: Date.now(), retries: 0 };
        return;
    }

    const nonce = Date.now() + backoff;
    const message = {
        type: subject,
        message: body,
        code: this.pageAPICode,
        nonce: nonce,
    };

    if (id !== null && id !== undefined) {
        message.id = id;
    }

    // Cache for retry on NONCE_REJECTED
    this._lastSent = { subject, body, id, nonce, retries: 0 };

    window.parent.postMessage(message, this.parentOrigin);
}
```

- `nonce` is `Date.now() + backoff` — millisecond precision, monotonic. The backoff (added on retries) guarantees a unique value even if `Date.now()` hasn't ticked.
- Same-origin messages within the same millisecond are possible but extremely unlikely for user-driven events. If a collision occurs, the parent rejects the duplicate and the child retries.
- When queuing (pre-handshake), `_lastSent` is still populated so `NONCE_REJECTED` retry works even if the rejection arrives before the poller flushes the queue.
- `retries: 0` is always the initial value; the retry counter is stamped onto the object after `send()` returns (see "Retry on Rejection").

### Parent: Nonce Validation (`state.js:handleMessage`)

```js
// Inserted after code check (Layer 2), before message unwrap

if (event.data.type !== "ORIGIN") {
    const nonce = event.data.nonce;
    const now = Date.now();

    // Must be a number
    if (typeof nonce !== "number") {
        this._rejectNonce(nonce);
        return;
    }

    // Temporal window: ±5 minutes
    if (now - nonce > 300000 || now - nonce < 0) {
        this._rejectNonce(nonce);
        return;
    }

    // Duplicate check
    if (this._seenNonces.has(nonce)) {
        this._rejectNonce(nonce);
        return;
    }

    // Accept
    this._seenNonces.set(nonce, now);
}

// Helper
_rejectNonce: function(nonce) {
    console.error("Invalid or expired nonce -->", nonce);
    if (this.lessonFrame && this.lessonFrame.contentWindow) {
        this.lessonFrame.contentWindow.postMessage({
            type: "NONCE_REJECTED",
            nonce: nonce,
        }, window.location.origin);
    }
}
```

### Seen Set with Periodic Pruning

Nonces are stored in a `Map<nonce, timestamp>` to detect duplicates. A `setInterval` prunes entries older than 5 minutes, keeping memory bounded.

```js
// In state.init() or alongside other initialization:
if (this._noncePruneTimer) {
    clearInterval(this._noncePruneTimer);
}
this._seenNonces = new Map();
this._noncePruneTimer = setInterval(() => {
    const cutoff = Date.now() - 300000; // 5 minutes
    for (const [nonce, ts] of this._seenNonces) {
        if (ts < cutoff) this._seenNonces.delete(nonce);
    }
}, 60000);
```

The `clearInterval` guard prevents timer leaks if `init()` is called more than once (e.g. during hot-reload or test re-initialization).

The prune interval (60 seconds) is a lightweight sweep — at most O(N) where N is messages in the last 5 minutes (typically < 100).

### Retry on Rejection

When the parent rejects a nonce, it sends a `NONCE_REJECTED` message back to the child. The child's `receive()` handler checks this against its `_lastSent` cache and retries with a fresh nonce.

```js
// In children.js receive():
case "NONCE_REJECTED":
    if (!this._lastSent) break;
    if (this._lastSent.nonce !== event.data.nonce) break; // not our message

    const retryCount = (this._lastSent.retries || 0) + 1;
    if (retryCount > 3) {
        console.error("Nonce retry exhausted, dropping message");
        this._lastSent = null;
        break;
    }

    const backoff = retryCount * 10;
    const oldSubject = this._lastSent.subject;
    const oldBody = this._lastSent.body;
    const oldId = this._lastSent.id;

    this.send(oldSubject, oldBody, oldId, backoff);
    this._lastSent.retries = retryCount;
    break;
```

Key design notes:

1. **`retryCount` is set AFTER `send()` returns.** This works because `send()` creates a fresh `_lastSent` object with `retries: 0`. The assignment `this._lastSent.retries = retryCount` stamps the counter onto that new object, making it survive across retry cycles.

2. **`_lastSent` is NOT nulled before retry.** The counter must be stamped on the object that `send()` creates. Nulling first would lose the reference — there is no re-trigger risk because `_lastSent.nonce` always changes with each retry, so a stale `NONCE_REJECTED` carrying the old nonce fails the `nonce !== event.data.nonce` guard.

3. **`retries > 3` means up to 3 retries** (original + 3 = 4 total sends). A check of `>= 3` would allow only 2 retries.

4. **Edge case — queued message:** When `send()` queues a message because `pageAPICode` is not yet set, `_lastSent` is populated immediately with a tentative nonce. If the poller later calls `send()` again, `_lastSent` is overwritten with the real nonce. If a `NONCE_REJECTED` somehow arrives between queueing and poller flush, it's silently dropped (nonce won't match).

### Retry Flow

```
Child                              Parent
  │                                  │
  ├── QUIZ_RESULT (nonce=T1) ──────►│
  │                                  ├── T1 already in Seen Set
  │◄── NONCE_REJECTED (nonce=T1) ───┤
  │                                  │
  ├── check _lastSent.nonce === T1  │
  ├── retries=1, backoff=10ms       │
  ├── QUIZ_RESULT (nonce=T1+10) ───►│
  │                                  ├── T1+10 accepted
  │                                  │
```

The 3-retry cap prevents infinite loops. In practice, retries should rarely fire — they exist as defense-in-depth against clock anomalies or race conditions.

---

## Message Types

### Child → Parent

| Type | Purpose | Payload |
|---|---|---|
| `ORIGIN` | Handshake bootstrap | `""` (empty) |
| `PONG` | Heartbeat response | Echo of PING data |
| `SEND_META` | Request page metadata | `""` |
| `QUIZ_RESULT` | Quiz submission | `{ id, value: { score, maxScore, answers } }` |
| `GET_QUIZ_DATA` | Request quiz state | `{ id, value: "" }` |

### Parent → Child

| Type | Purpose | Payload |
|---|---|---|
| `ORIGIN` | Handshake response | `window.location.origin` |
| `PING` | Heartbeat | arbitrary |
| `SEND_META` | Page metadata | page config object |
| `GET_STUDENT_DATA` | Student name/grade | `{ name, grade }` |
| `QUIZ_DATA` | Quiz state response | `{ id, value: { questions, userAnswers, attemptsLeft, options, hasAttempted } }` |
| `QUIZ_RESULTS` | Quiz results notification | result data |
| `SET_THEME` | Theme switch | theme name string |
| `NONCE_REJECTED` | Nonce validation failure | `{ nonce }` |

---

## Error Handling

### Parent-side rejections

| Condition | Logged Message | Action |
|---|---|---|
| Cross-origin message | `"Unknown message sender!"` | Drop silently |
| Pre-handshake message | `"Message received before handshake complete"` | Drop silently |
| Invalid code | `"Invalid code --> {code}"` | Drop silently |
| Missing/invalid nonce | `"Invalid or expired nonce --> {nonce}"` | Send `NONCE_REJECTED` |
| Expired nonce (>5 min) | `"Invalid or expired nonce --> {nonce}"` | Send `NONCE_REJECTED` |
| Duplicate nonce | `"Invalid or expired nonce --> {nonce}"` | Send `NONCE_REJECTED` |

### Child-side rejection handling

| Condition | Action |
|---|---|
| `NONCE_REJECTED` matched to `_lastSent` | Retry with backoff (up to 3 times) |
| `NONCE_REJECTED` unmatched (stale/other) | Drop silently |
| 3 retries exhausted | Log error, clear `_lastSent`, drop message |
