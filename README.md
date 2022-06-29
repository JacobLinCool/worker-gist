# Worker Gist

GitHub Gist as KV, for Cloudflare Workers.

It is slower than KV, but it helps to keep the number of KV `write` operation as low as possible.

## Usage

```ts
import { GistStore } from "worker-gist";

const store = new GistStore(env.KV, env.PAT);

const logs = JSON.parse((await store.get("logs")) || "[]");

logs.push({ time: Date.now(), msg: "Something to log." });

await store.set("logs", JSON.stringify(logs));
```
