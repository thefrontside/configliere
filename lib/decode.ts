export type Decoder = (value: string) => unknown[];

export const number: Decoder = (value) => {
  if (!numeric.test(value)) {
    return [];
  }

  let decoded = Number(value);
  return Number.isFinite(decoded) ? [decoded] : [];
};

export const scalar: Decoder = (value) => {
  return [...number(value), value];
};

export const boolean: Decoder = (value) => {
  if (value === "true") {
    return [true];
  }
  if (value === "false") {
    return [false];
  }
  return [];
};

const numeric = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
