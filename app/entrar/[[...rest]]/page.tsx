import { SignIn } from "@clerk/nextjs";
import { connection } from "next/server";
import { ProveedorClerk } from "../../providers";

export default async function EntrarPage() {
  await connection();
  const disponible = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center gap-6 px-6 py-12 text-ink">
      <h1 className="font-display text-3xl font-semibold">Entrar al panel</h1>
      {disponible ? (
        <ProveedorClerk>
          <SignIn routing="path" path="/entrar" forceRedirectUrl="/panel" />
        </ProveedorClerk>
      ) : <p>El acceso al panel todavía no está configurado.</p>}
    </main>
  );
}
