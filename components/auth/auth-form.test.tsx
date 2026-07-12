// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loginAction, routerReplace, toastSuccess } = vi.hoisted(() => ({
  loginAction: vi.fn(),
  routerReplace: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/app/auth/actions", () => ({
  loginAction,
  signUpAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: routerReplace }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: toastSuccess } }));

import { AuthForm } from "@/components/auth/auth-form";

describe("AuthForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    loginAction.mockReset();
    routerReplace.mockReset();
    toastSuccess.mockReset();
  });

  it("shows client validation errors without submitting", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" nextValue="/profile" />);

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByText("Informe seu e-mail.")).not.toBeNull();
    expect(screen.getByText("Informe sua senha.")).not.toBeNull();
    expect(loginAction).not.toHaveBeenCalled();
  });

  it("shows loading and prevents a duplicate submit", async () => {
    let resolveAction: ((value: unknown) => void) | undefined;
    loginAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<AuthForm mode="login" nextValue="/profile" />);

    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "segredo-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Entrando…" }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    await user.click(screen.getByRole("button", { name: "Entrando…" }));
    expect(loginAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAction?.({
        status: "success",
        fieldErrors: {},
        message: "Login realizado com sucesso.",
        redirectTo: "/profile",
      });
    });

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/profile"));
    expect(toastSuccess).toHaveBeenCalledWith({ title: "Login realizado com sucesso." });
  });
});
