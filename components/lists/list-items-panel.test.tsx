// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createListItemAction,
  deleteListItemAction,
  updateListItemAction,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  createListItemAction: vi.fn(),
  deleteListItemAction: vi.fn(),
  updateListItemAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/app/groups/list-items-actions", () => ({
  createListItemAction,
  deleteListItemAction,
  updateListItemAction,
}));
vi.mock("@/lib/lists/use-list-items-realtime", () => ({
  useListItemsRealtime: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { ListItemsPanel } from "@/components/lists/list-items-panel";

const baseProps = {
  groupId: "g1",
  listId: "list-1",
  currentUserId: "user-1",
  memberNamesByUserId: { "user-1": "Ana" } as Record<string, string | null>,
};

describe("ListItemsPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    createListItemAction.mockReset();
    deleteListItemAction.mockReset();
    updateListItemAction.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.stubGlobal(
      "crypto",
      {
        ...crypto,
        randomUUID: () => "11111111-1111-4111-8111-111111111111",
      } as Crypto,
    );
  });

  it("shows client validation errors when adding without a name", async () => {
    const user = userEvent.setup();
    render(<ListItemsPanel {...baseProps} items={[]} />);

    await user.clear(screen.getByLabelText("Quantidade"));
    await user.type(screen.getByLabelText("Quantidade"), "0");
    await user.click(screen.getByRole("button", { name: "Adicionar item" }));

    expect(screen.getByText("Informe o nome do item.")).not.toBeNull();
    expect(screen.getByText("A quantidade deve ser maior que zero.")).not.toBeNull();
    expect(createListItemAction).not.toHaveBeenCalled();
  });

  it("optimistically shows a new item and creator label", async () => {
    const user = userEvent.setup();
    createListItemAction.mockImplementation(async () => ({
      status: "success",
      fieldErrors: {},
      message: "Item adicionado.",
    }));

    render(<ListItemsPanel {...baseProps} items={[]} />);

    await user.type(screen.getByLabelText("Nome"), "Arroz");
    await user.clear(screen.getByLabelText("Quantidade"));
    await user.type(screen.getByLabelText("Quantidade"), "2");
    await user.type(screen.getByLabelText("Unidade"), "kg");
    await user.click(screen.getByRole("button", { name: "Adicionar item" }));

    expect(screen.getByText("Arroz")).not.toBeNull();
    expect(screen.getByText("2 kg")).not.toBeNull();
    expect(screen.getByText("Adicionado por Ana")).not.toBeNull();

    await waitFor(() => {
      expect(createListItemAction).toHaveBeenCalled();
    });
  });

  it("opens edit and delete dialogs for existing items", async () => {
    const user = userEvent.setup();
    render(
      <ListItemsPanel
        {...baseProps}
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
    expect(screen.getByText("Adicionado por Ana")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("heading", { name: "Editar item" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.getByRole("heading", { name: "Remover item" })).not.toBeNull();
    expect(updateListItemAction).not.toHaveBeenCalled();
    expect(deleteListItemAction).not.toHaveBeenCalled();
  });
});
