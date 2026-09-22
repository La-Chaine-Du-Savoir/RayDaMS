import { Redis } from "redis";

const store = new Map<string, string>([["refresh_tokens:abc", "1"]]);

function applySet(
  key: string,
  value: string | number,
  args: Array<string | number>,
) {
  const nx = args.includes("NX");
  if (nx && store.has(key)) return null;
  store.set(key, String(value));
  return "OK";
}

function applyOp(op: string, args: unknown[]) {
  switch (op) {
    case "set":
      return applySet(
        args[0] as string,
        args[1] as string | number,
        args.slice(2) as Array<string | number>,
      );
    case "del":
      return store.delete(args[0] as string) ? 1 : 0;
    case "zadd":
    case "zrem":
    case "expire":
      return 1;
    default:
      return "OK";
  }
}

function createPipeline() {
  const ops: Array<[string, unknown[]]> = [];
  const pipeline: Record<string, unknown> = {
    set(_k: string, _v: string | number, ..._args: Array<string | number>) {
      ops.push(["set", [_k, _v, ..._args]]);
      return pipeline;
    },
    zadd(_k: string, _score: number, _member: string) {
      ops.push(["zadd", [_k, _score, _member]]);
      return pipeline;
    },
    zrem(_k: string, _member: string) {
      ops.push(["zrem", [_k, _member]]);
      return pipeline;
    },
    expire(_k: string, _t: number) {
      ops.push(["expire", [_k, _t]]);
      return pipeline;
    },
    del(_k: string) {
      ops.push(["del", [_k]]);
      return pipeline;
    },
    exec() {
      const results = ops.map(([op, args]) => {
        const result = applyOp(op, args);
        return [null, result] as [null, unknown];
      });
      return Promise.resolve(results);
    },
  };

  return pipeline;
}

export default {
  get(key: string) {
    return Promise.resolve(store.get(key) ?? null);
  },
  set(key: string, value: string | number, ...args: Array<string | number>) {
    return Promise.resolve(applySet(key, value, args));
  },
  del(key: string) {
    return Promise.resolve(store.delete(key) ? 1 : 0);
  },
  zrem(_key: string, _member: string) {
    return Promise.resolve(1);
  },
  xadd(_key: string, _id: string, ..._args: Array<string | number>) {
    return Promise.resolve("1-0");
  },
  xread() {
    return Promise.resolve(null);
  },
  disconnect() {
    return undefined;
  },
  quit() {
    return Promise.resolve("OK");
  },
  close() {
    return undefined;
  },
  pipeline() {
    return createPipeline();
  },
} as unknown as Redis;
