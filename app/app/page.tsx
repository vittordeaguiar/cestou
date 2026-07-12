import Link from "next/link";

export const metadata = {
  title: "App — Cestou",
};

export default function AppHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <h1 className="text-display text-foreground">Cestou</h1>
      <p className="text-body text-muted-foreground mt-3 max-w-sm text-center">
        Sua área autenticada. Grupos e listas chegam em breve.
      </p>
      <Link
        href="/profile"
        className="text-primary text-small mt-8 font-medium underline-offset-4 hover:underline"
      >
        Ir para o perfil
      </Link>
    </main>
  );
}
