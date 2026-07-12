import { AuthForm } from "@/components/auth/auth-form";
import { getSafeNext } from "@/lib/auth/redirect";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[]; notice?: string | string[] }>;
};

export const metadata = {
  title: "Entrar — Cestou",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextValue = getSafeNext(typeof params.next === "string" ? params.next : undefined);
  const notice = params.notice === "logout" ? "logout" : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <AuthForm mode="login" nextValue={nextValue} notice={notice} />
    </main>
  );
}
