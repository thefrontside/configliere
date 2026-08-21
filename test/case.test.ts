import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  type EnvCase,
  type KebabCase,
  toEnvCase,
  toKebabCase,
} from "../lib/case.ts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true
  : false;

type Assert<T extends true> = T;

/*
 * type tests
 */
type _clientIdEnv = Assert<Equal<EnvCase<"clientID">, "CLIENT_ID">>;
type _clientIdKebab = Assert<Equal<KebabCase<"clientID">, "client-id">>;
type _apiResponseKebab = Assert<
  Equal<KebabCase<"APIResponse">, "api-response">
>;
type _httpServerEnv = Assert<Equal<EnvCase<"HTTPServer">, "HTTP_SERVER">>;
type _clientIdToJwtKebab = Assert<
  Equal<KebabCase<"clientIDtoJWT">, "client-id-to-jwt">
>;
type _clientIdToJwtEnv = Assert<
  Equal<EnvCase<"clientIDtoJWT">, "CLIENT_ID_TO_JWT">
>;
type _clientIdWordToJwtEnv = Assert<
  Equal<EnvCase<"clientIDToJWT">, "CLIENT_ID_TO_JWT">
>;
type _clientIdCamelToJwtKebab = Assert<
  Equal<KebabCase<"clientIdToJWT">, "client-id-to-jwt">
>;
type _sslConfigKebab = Assert<Equal<KebabCase<"SSLConfig">, "ssl-config">>;
type _xmlHttpRequestEnv = Assert<
  Equal<EnvCase<"XMLHttpRequest">, "XML_HTTP_REQUEST">
>;
type _user2FaEnabledKebab = Assert<
  Equal<KebabCase<"user2FAEnabled">, "user-2-fa-enabled">
>;
type _reallyLongEnv = Assert<
  Equal<
    EnvCase<"reallyLongButPossiblyHelpful">,
    "REALLY_LONG_BUT_POSSIBLY_HELPFUL"
  >
>;

/*
 * runtime tests
 */
describe("case conversion", () => {
  it("preserves acronym runs when converting to kebab-case", () => {
    expect(toKebabCase("clientID")).toEqual("client-id");
    expect(toKebabCase("APIResponse")).toEqual("api-response");
    expect(toKebabCase("HTTPServer")).toEqual("http-server");
    expect(toKebabCase("clientIDToJWT")).toEqual("client-id-to-jwt");
    expect(toKebabCase("clientIDtoJWT")).toEqual("client-id-to-jwt");
    expect(toKebabCase("clientIdToJWT")).toEqual("client-id-to-jwt");
    expect(toKebabCase("SSLConfig")).toEqual("ssl-config");
    expect(toKebabCase("XMLHttpRequest")).toEqual("xml-http-request");
    expect(toKebabCase("user2FAEnabled")).toEqual("user-2-fa-enabled");
    expect(toKebabCase("reallyLongButPossiblyHelpful")).toEqual(
      "really-long-but-possibly-helpful",
    );
  });

  it("preserves acronym runs when converting to env-case", () => {
    expect(toEnvCase("clientID")).toEqual("CLIENT_ID");
    expect(toEnvCase("APIResponse")).toEqual("API_RESPONSE");
    expect(toEnvCase("HTTPServer")).toEqual("HTTP_SERVER");
    expect(toEnvCase("clientIDToJWT")).toEqual("CLIENT_ID_TO_JWT");
    expect(toEnvCase("clientIDtoJWT")).toEqual("CLIENT_ID_TO_JWT");
    expect(toEnvCase("clientIdToJWT")).toEqual("CLIENT_ID_TO_JWT");
    expect(toEnvCase("SSLConfig")).toEqual("SSL_CONFIG");
    expect(toEnvCase("XMLHttpRequest")).toEqual("XML_HTTP_REQUEST");
    expect(toEnvCase("user2FAEnabled")).toEqual("USER_2_FA_ENABLED");
    expect(toEnvCase("reallyLongButPossiblyHelpful")).toEqual(
      "REALLY_LONG_BUT_POSSIBLY_HELPFUL",
    );
  });
});
