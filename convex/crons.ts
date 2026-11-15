import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("expire due cobros", { minutes: 1 }, internal.motor.cobros.expirarVencidos, { cursor: null });
crons.interval("purge old DEMO data", { hours: 1 }, internal.motor.purga.purgarDemo, { tabla: "simTransacciones", cursor: null });
crons.interval("recover LIVE QR attempts", { minutes: 1 }, internal.motor.barrido.recuperar, {});
crons.interval("daily pey account readiness", { hours: 24 }, internal.motor.cuenta.comprobarCuenta, {});

export default crons;
