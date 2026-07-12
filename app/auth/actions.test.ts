import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getSupabaseSiteUrl, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseSiteUrl: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseSiteUrl }));
vi.mock("next/navigation", () => ({ redirect }));

import { loginAction, logoutAction, signUpAction } from "@/app/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();

  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("authentication server actions", () => {
  beforeEach(() => {
    createClient.mockReset();
    getSupabaseSiteUrl.mockReset();
    getSupabaseSiteUrl.mockReturnValue("http://localhost:3000/");
    redirect.mockReset();
  });

  it("creates an account with normalized metadata and a safe destination", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" }, session: { access_token: "token" } },
      error: null,
    });
    createClient.mockResolvedValue({ auth: { signUp } });

    await expect(
      signUpAction(
        initialAuthActionState,
        formData({
          name: "  Ana   Maria ",
          email: " ANA@EXAMPLE.COM ",
          password: "segredo-123",
          passwordConfirmation: "segredo-123",
          next: "https://attacker.example",
        }),
      ),
    ).resolves.toMatchObject({ status: "success", redirectTo: "/profile" });

    expect(signUp).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "segredo-123",
      options: {
        emailRedirectTo: "http://localhost:3000/",
        data: { display_name: "Ana Maria" },
      },
    });
  });

  it("returns field errors before calling Supabase", async () => {
    await expect(
      signUpAction(
        initialAuthActionState,
        formData({ name: "", email: "bad", password: "short", passwordConfirmation: "different" }),
      ),
    ).resolves.toMatchObject({ status: "error", fieldErrors: { name: expect.any(String) } });

    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not expose a Supabase sign-up failure", async () => {
    createClient.mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { session: null },
          error: new Error("User already registered"),
        }),
      },
    });

    await expect(
      signUpAction(
        initialAuthActionState,
        formData({
          name: "Ana",
          email: "ana@example.com",
          password: "segredo-123",
          passwordConfirmation: "segredo-123",
        }),
      ),
    ).resolves.toMatchObject({
      status: "error",
      message: "Não foi possível criar sua conta. Verifique os dados e tente novamente.",
    });
  });

  it("signs in with an email and password", async () => {
    const signInWithPassword = vi
      .fn()
      .mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    createClient.mockResolvedValue({ auth: { signInWithPassword } });

    await expect(
      loginAction(
        initialAuthActionState,
        formData({ email: "ANA@EXAMPLE.COM", password: "segredo-123", next: "/profile" }),
      ),
    ).resolves.toMatchObject({ status: "success", redirectTo: "/profile" });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "segredo-123",
    });
  });

  it("returns one safe error for invalid credentials", async () => {
    createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: new Error("Invalid login credentials"),
        }),
      },
    });

    await expect(
      loginAction(
        initialAuthActionState,
        formData({ email: "ana@example.com", password: "segredo-123" }),
      ),
    ).resolves.toMatchObject({ status: "error", message: "E-mail ou senha inválidos." });
  });

  it("ends only the current session and redirects to login", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue({ auth: { signOut } });

    await logoutAction();

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirect).toHaveBeenCalledWith("/auth/login?notice=logout");
  });
});
