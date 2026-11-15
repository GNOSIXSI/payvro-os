/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cobros from "../cobros.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as motor_barrido from "../motor/barrido.js";
import type * as motor_bitacora from "../motor/bitacora.js";
import type * as motor_cobros from "../motor/cobros.js";
import type * as motor_cuenta from "../motor/cuenta.js";
import type * as motor_intentos from "../motor/intentos.js";
import type * as motor_liberar from "../motor/liberar.js";
import type * as motor_limites from "../motor/limites.js";
import type * as motor_peyPuerto from "../motor/peyPuerto.js";
import type * as motor_puertos from "../motor/puertos.js";
import type * as motor_purga from "../motor/purga.js";
import type * as motor_tablas from "../motor/tablas.js";
import type * as motor_verificar from "../motor/verificar.js";
import type * as negocio from "../negocio.js";
import type * as panel from "../panel.js";
import type * as publico from "../publico.js";
import type * as puertos from "../puertos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cobros: typeof cobros;
  crons: typeof crons;
  demo: typeof demo;
  "motor/barrido": typeof motor_barrido;
  "motor/bitacora": typeof motor_bitacora;
  "motor/cobros": typeof motor_cobros;
  "motor/cuenta": typeof motor_cuenta;
  "motor/intentos": typeof motor_intentos;
  "motor/liberar": typeof motor_liberar;
  "motor/limites": typeof motor_limites;
  "motor/peyPuerto": typeof motor_peyPuerto;
  "motor/puertos": typeof motor_puertos;
  "motor/purga": typeof motor_purga;
  "motor/tablas": typeof motor_tablas;
  "motor/verificar": typeof motor_verificar;
  negocio: typeof negocio;
  panel: typeof panel;
  publico: typeof publico;
  puertos: typeof puertos;
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
