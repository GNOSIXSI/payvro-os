/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as _stub_fixtures from "../_stub/fixtures.js";
import type * as cobros from "../cobros.js";
import type * as demo from "../demo.js";
import type * as motor_tablas from "../motor/tablas.js";
import type * as negocio from "../negocio.js";
import type * as panel from "../panel.js";
import type * as publico from "../publico.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "_stub/fixtures": typeof _stub_fixtures;
  cobros: typeof cobros;
  demo: typeof demo;
  "motor/tablas": typeof motor_tablas;
  negocio: typeof negocio;
  panel: typeof panel;
  publico: typeof publico;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
