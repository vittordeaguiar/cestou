// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createListItemAction,
  deleteListItemAction,
  updateListItemAction,
  routerRefresh,
  toastSuccess,
} = vi.hoisted(() => ({
  createListItemAction: vi.fn(),
  deleteListItemAction: vi.fn(),
  updateListItemAction: vi.fn(),
  routerRefresh: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/app/app/groups/list-items-actions", () => ({
  createListItemAction,
  deleteListItemAction,
  updateListItemAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: routerRefresh }) }));
vi.mock("@/lib/toast", () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}));

import { ListItemsPanel } from "@/components/lists/list-items-panel";

describe("ListItemsPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    createListItemAction.mockReset();
    deleteListItemAction.mockReset();
    updateListItemAction.mockReset();
    routerRefresh.mockReset();
    toastSuccess.mockReset();
  });

  it("shows client validation errors when adding without a name", async () => {
    const user = userEvent.setup();
    render(<ListItemsPanel groupId="g1" items={[]} />);

    await user.clear(screen.getByLabelText("Quantidade"));
    await user.type(screen.getByLabelText("Quantidade"), "0");
    await user.click(screen.getByRole("button", { name: "Adicionar item" }));

    expect(screen.getByText("Informe o nome do item.")).not.toBeNull();
    expect(screen.getByText("A quantidade deve ser maior que zero.")).not.toBeNull();
    expect(createListItemAction).not.toHaveBeenCalled();
  });

  it("opens edit and delete dialogs for existing items", async () => {
    const user = userEvent.setup();
    render(
      <ListItemsPanel
        groupId="g1"
        items={[
          {
            id: "item-1",
            listId: "list-1",
            name: "Arroz",
            quantity: 2,
            unit: "kg",
            createdBy: "user-1",
            createdAt: "2026-08-08T12:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("2 kg")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("heading", { name: "Editar item" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.getByRole("heading", { name: "Remover item" })).not.toBeNull();
    expect(updateListItemAction).not.toHaveBeenCalled();
    expect(deleteListItemAction).not.toHaveBeenCalled();
  });
});
