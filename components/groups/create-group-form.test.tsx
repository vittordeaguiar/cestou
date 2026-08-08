// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createGroupAction, routerReplace, toastSuccess } = vi.hoisted(() => ({
  createGroupAction: vi.fn(),
  routerReplace: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/app/app/groups/actions", () => ({ createGroupAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: routerReplace }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: toastSuccess } }));

import { CreateGroupForm } from "@/components/groups/create-group-form";

describe("CreateGroupForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    createGroupAction.mockReset();
    routerReplace.mockReset();
    toastSuccess.mockReset();
  });

  it("shows client validation errors without submitting", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await user.click(screen.getByRole("button", { name: "Criar grupo" }));

    expect(screen.getByText("Informe o nome do grupo.")).not.toBeNull();
    expect(createGroupAction).not.toHaveBeenCalled();
  });
});
