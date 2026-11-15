/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _stub_fixtures from "../_stub/fixtures.js";
import type * as cobros from "../cobros.js";
import type * as demo from "../demo.js";
import type * as negocio from "../negocio.js";
import type * as panel from "../panel.js";
import type * as publico from "../publico.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_stub/fixtures": typeof _stub_fixtures;
  cobros: typeof cobros;
  demo: typeof demo;
  negocio: typeof negocio;
  panel: typeof panel;
  publico: typeof publico;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
