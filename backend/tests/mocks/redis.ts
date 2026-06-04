export default {
  get(key: string) {
    if (key.startsWith("refresh_tokens:")) return Promise.resolve("1");
    return Promise.resolve(null);
  },
  del(_key: string) {
    return Promise.resolve(1);
  },
  zrem(_key: string, _member: string) {
    return Promise.resolve(1);
  },
  pipeline() {
    const ops: unknown[] = [];
    return {
      set(_k: string, _v: string | number, _opts?: Record<string, unknown>) {
        ops.push(["set", _k, _v, _opts]);
        return this;
      },
      zadd(_k: string, _score: number, _member: string) {
        ops.push(["zadd", _k, _score, _member]);
        return this;
      },
      zrem(_k: string, _member: string) {
        ops.push(["zrem", _k, _member]);
        return this;
      },
      expire(_k: string, _t: number) {
        ops.push(["expire", _k, _t]);
        return this;
      },
      del(_k: string) {
        ops.push(["del", _k]);
        return this;
      },
      flush() {
        return Promise.resolve(ops);
      },
    };
  },
  sendCommand() {
    return Promise.resolve("OK");
  },
};
