import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const modoInforme = v.union(
  v.literal("demo"),
  v.literal("live"),
  v.literal("ausente"),
  v.literal("invalido"),
);
const cuentaInforme = v.union(
  v.literal("ACTIVE"),
  v.literal("PENDING"),
  v.literal("PROCESSING"),
  v.literal("ERROR"),
  v.literal("no_se_pudo_consultar"),
  v.literal("no_aplica"),
);

function presente(valor: string | undefined): boolean {
  return typeof valor === "string" && valor.trim().length > 0;
}

function modoDe(valor: string | undefined): "demo" | "live" | "ausente" | "invalido" {
  if (valor === undefined || valor.trim() === "") return "ausente";
  if (valor === "demo" || valor === "live") return valor;
  return "invalido";
}

function contarDueños(valor: string | undefined): number {
  if (!valor) return 0;
  return valor.split(",").map((correo) => correo.trim()).filter((correo) => correo.length > 0).length;
}

function cuentaVisible(
  estado: string,
): "ACTIVE" | "PENDING" | "PROCESSING" | "ERROR" | "no_se_pudo_consultar" {
  if (estado === "ACTIVE" || estado === "PENDING" || estado === "PROCESSING" || estado === "ERROR") return estado;
  return "no_se_pudo_consultar";
}

export const revisar = internalAction({
  args: {},
  returns: v.object({
    modo: modoInforme,
    peyApiKey: v.boolean(),
    peyBankAccountId: v.boolean(),
    peyWebhookSecret: v.boolean(),
    clerkJwtIssuerDomain: v.boolean(),
    payvroPublicUrl: v.boolean(),
    ownerEmails: v.number(),
    cuentaPey: cuentaInforme,
  }),
  handler: async (ctx) => {
    const modo = modoDe(process.env.PAYVRO_MODE);
    let cuentaPey: "ACTIVE" | "PENDING" | "PROCESSING" | "ERROR" | "no_se_pudo_consultar" | "no_aplica" = "no_aplica";
    if (modo === "live") {
      const revision: { ok: boolean; estado: string } = await ctx.runAction(internal.motor.cuenta.comprobarCuenta, {});
      cuentaPey = cuentaVisible(revision.estado);
    }
    return {
      modo,
      peyApiKey: presente(process.env.PEY_API_KEY),
      peyBankAccountId: presente(process.env.PEY_BANK_ACCOUNT_ID),
      peyWebhookSecret: presente(process.env.PEY_WEBHOOK_SECRET),
      clerkJwtIssuerDomain: presente(process.env.CLERK_JWT_ISSUER_DOMAIN),
      payvroPublicUrl: presente(process.env.PAYVRO_PUBLIC_URL),
      ownerEmails: contarDueños(process.env.PAYVRO_OWNER_EMAILS),
      cuentaPey,
    };
  },
});
