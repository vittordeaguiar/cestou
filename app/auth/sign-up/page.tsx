import { AuthForm } from "@/components/auth/auth-form";
import { getSafeNext } from "@/lib/auth/redirect";

type SignUpPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export const metadata = {
  title: "Criar conta — Cestou",
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const nextValue = getSafeNext(typeof params.next === "string" ? params.next : undefined);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <AuthForm mode="sign-up" nextValue={nextValue} />
    </main>
  );
}
