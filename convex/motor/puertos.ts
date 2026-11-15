import type { Id } from "../_generated/dataModel";
import type { ActionCtx, QueryCtx, MutationCtx } from "../_generated/server";

export type Modo = "demo" | "live";
export type Actor = { tipo: "dueno" | "simulador"; id?: string };
export interface ResolucionNegocio {
  negocioId: Id<"negocios">;
  modo: Modo;
  actor: Actor;
}
export interface CredencialPey {
  apiKey: string;
  bankAccountId: string;
  webhookSecret?: string;
}

export interface PuertosMotor {
  modo(): Modo;
  resolverNegocio(ctx: QueryCtx | MutationCtx): Promise<ResolucionNegocio>;
  resolverNegocioEscritura(ctx: MutationCtx): Promise<ResolucionNegocio>;
  credencialPey(ctx: ActionCtx, negocioId: Id<"negocios">): Promise<CredencialPey>;
  urlsRetorno(cobroPublicId: string): { successUrl: string; backUrl: string };
}
