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

const numeric = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
