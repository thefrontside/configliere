export const lens = {
  set<T>(path: string[], value: unknown, target: T): T {
    if (path.length === 0) {
      return value as T;
    }
    let [key, ...rest] = path;

    let current = (target ?? {} as T)[key as keyof T] ?? {};

    return {
      ...target,
      [key]: lens.set(rest, value, current),
    };
  },
};
