import { type } from "arktype";

const unknown = type('unknown');

export type Unknown = typeof unknown;

const maybe = type.unknown.optional();



// function print(s: {}) {
//   let schema = type(s);

//   const { meta, infer } = schema;

//   console.log({ meta, infer });
//   type(s).props.forEach((prop) => {
//     const { key, kind, meta } = prop;
//     console.log({ key, kind, meta });
//   });
// }

// print({ foo: "number" });

// const x = type("string[]").extends(type("unknown[]"));
// const y = type("string[]").extends(type("boolean"));

// console.log({ x, y });

// const { parse } = configliere({
//   port: {
//     schema: type("number"),
//     alias: "-p",
//     array: true,
//   }
// });

