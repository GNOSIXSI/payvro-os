import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as cobros from "../cobros.js";
import type * as demo from "../demo.js";
import type * as negocio from "../negocio.js";
import type * as panel from "../panel.js";
import type * as publico from "../publico.js";

declare const fullApi: ApiFromModules<{
  cobros: typeof cobros;
  demo: typeof demo;
  negocio: typeof negocio;
  panel: typeof panel;
  publico: typeof publico;
}>;

export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
export declare const components: {};
