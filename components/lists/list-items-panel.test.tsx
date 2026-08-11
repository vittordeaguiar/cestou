// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createListItemAction,
  deleteListItemAction,
  updateListItemAction,
  setListItemPurchasedAction,
  useListItemsRealtime,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  createListItemAction: vi.fn(),
  deleteListItemAction: vi.fn(),
  updateListItemAction: vi.fn(),
  setListItemPurchasedAction: vi.fn(),
  useListItemsRealtime: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/app/groups/list-items-actions", () => ({
  createListItemAction,
  deleteListItemAction,
  updateListItemAction,
  setListItemPurchasedAction,
}));
vi.mock("@/lib/lists/use-list-items-realtime", () => ({
  useListItemsRealtime,
  fetchListItemsSnapshot: vi.fn().mockResolvedValue(null),
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

const arroz = {
  id: "11111111-1111-4111-8111-111111111111",
  listId: "list-1",
  name: "Arroz",
  quantity: 2,
  unit: "kg",
  category: null as null | "mercado" | "farmacia" | "outro",
  purchased: false,
  createdBy: "user-1",
  createdAt: "2026-08-08T12:00:00.000Z",
};

describe("ListItemsPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    createListItemAction.mockReset();
    deleteListItemAction.mockReset();
    updateListItemAction.mockReset();
    setListItemPurchasedAction.mockReset();
    useListItemsRealtime.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.stubGlobal("crypto", {
      ...crypto,
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    } as Crypto);
  });

  it("shows client validation errors when adding without a name", async () => {
    const user = userEvent.setup();
    render(<ListItemsPanel {...baseProps} items={[]} />);

    await user.click(screen.getByRole("button", { name: "Adicionar item" }));
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

    await user.click(screen.getByRole("button", { name: "Adicionar item" }));
    await user.type(screen.getByLabelText("Nome"), "Arroz");
    await user.clear(screen.getByLabelText("Quantidade"));
    await user.type(screen.getByLabelText("Quantidade"), "2");
    await user.type(screen.getByLabelText("Unidade"), "kg");
    await user.click(screen.getByRole("button", { name: "Adicionar item" }));

    expect(screen.getByText("Arroz")).not.toBeNull();
    expect(screen.getByText("2 kg")).not.toBeNull();
    expect(screen.getByText("Adicionado por Ana")).not.toBeNull();
    expect(screen.queryByText("Sua lista está pronta para começar")).toBeNull();

    await waitFor(() => {
      expect(createListItemAction).toHaveBeenCalled();
    });
  });

  it("opens edit and delete dialogs for existing items", async () => {
    const user = userEvent.setup();
    render(<ListItemsPanel {...baseProps} items={[arroz]} />);

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

  it("shows purchased items in the Comprados section on load", () => {
    render(<ListItemsPanel {...baseProps} items={[{ ...arroz, purchased: true }]} />);

    expect(screen.getByText("Nada pendente")).not.toBeNull();
    expect(screen.getByText("Comprados (1)")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "Marcar Arroz como pendente" })).not.toBeNull();
  });

  it("moves an item into Comprados when marked as purchased", async () => {
    const user = userEvent.setup();
    setListItemPurchasedAction.mockImplementation(async () => ({
      status: "success",
      fieldErrors: {},
      message: "Item marcado como comprado.",
    }));

    render(<ListItemsPanel {...baseProps} items={[arroz]} />);

    await user.click(screen.getByRole("checkbox", { name: "Marcar Arroz como comprado" }));

    expect(screen.getByText("Comprados (1)")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "Marcar Arroz como pendente" })).not.toBeNull();

    await waitFor(() => {
      expect(setListItemPurchasedAction).toHaveBeenCalled();
    });
  });

  it("rolls back purchased toggle when the action fails", async () => {
    const user = userEvent.setup();
    setListItemPurchasedAction.mockImplementation(async () => ({
      status: "error",
      fieldErrors: {},
      message: "Não foi possível atualizar o item. Tente novamente.",
    }));

    render(<ListItemsPanel {...baseProps} items={[arroz]} />);

    await user.click(screen.getByRole("checkbox", { name: "Marcar Arroz como comprado" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith({
        title: "Não foi possível atualizar o item. Tente novamente.",
      });
    });

    expect(screen.queryByText("Comprados (1)")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Marcar Arroz como comprado" })).not.toBeNull();
  });

  it("keeps delete reconciliation in the parent after optimistic removal", async () => {
    const user = userEvent.setup();
    deleteListItemAction.mockImplementation(async () => ({
      status: "error",
      fieldErrors: {},
      message: "Não foi possível remover o item. Tente novamente.",
    }));

    render(<ListItemsPanel {...baseProps} items={[arroz]} />);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    const confirmDelete = screen
      .getByRole("dialog")
      .querySelector("button[data-variant='destructive']");
    expect(confirmDelete).not.toBeNull();
    await user.click(confirmDelete as HTMLElement);

    await waitFor(() => {
      expect(deleteListItemAction).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText("Arroz")).not.toBeNull();
    });
    expect(toastError).toHaveBeenCalledWith({
      title: "Não foi possível remover o item. Tente novamente.",
    });
  });

  it("shows a category badge and filters the list by category", async () => {
    const user = userEvent.setup();
    const farmaciaItem = {
      ...arroz,
      id: "33333333-3333-4333-8333-333333333333",
      name: "Dipirona",
      category: "farmacia" as const,
      unit: null,
      quantity: 1,
    };
    const uncategorizedItem = {
      ...arroz,
      id: "44444444-4444-4444-8444-444444444444",
      name: "Papel-toalha",
    };

    render(
      <ListItemsPanel
        {...baseProps}
        items={[{ ...arroz, category: "mercado" }, farmaciaItem, uncategorizedItem]}
      />,
    );

    expect(screen.getByText("Arroz").closest("li")?.textContent).toContain("Mercado");
    expect(screen.getByText("Dipirona").closest("li")?.textContent).toContain("Farmácia");

    await user.click(screen.getByRole("button", { name: "Mercado" }));
    expect(screen.getByText("Arroz")).not.toBeNull();
    expect(screen.queryByText("Dipirona")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Farmácia" }));
    expect(screen.getByText("Dipirona")).not.toBeNull();
    expect(screen.queryByText("Arroz")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Sem categoria" }));
    expect(screen.getByText("Papel-toalha")).not.toBeNull();
    expect(screen.queryByText("Dipirona")).toBeNull();
  });

  it("keeps edit feedback mounted and rolls back a category change under an active filter", async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (result: {
      status: "error";
      fieldErrors: Record<string, string>;
      message: string;
    }) => void;
    updateListItemAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<ListItemsPanel {...baseProps} items={[{ ...arroz, category: "mercado" }]} />);

    await user.click(screen.getByRole("button", { name: "Mercado" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Categoria"), "farmacia");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateListItemAction).toHaveBeenCalled());
    expect(screen.queryByText("Arroz")).toBeNull();
    expect(screen.getByRole("dialog")).not.toBeNull();

    resolveUpdate({
      status: "error",
      fieldErrors: {},
      message: "Não foi possível atualizar o item. Tente novamente.",
    });

    await waitFor(() => expect(screen.getByText("Arroz")).not.toBeNull());
    expect(screen.getByRole("dialog").textContent).toContain(
      "Não foi possível atualizar o item. Tente novamente.",
    );
    expect(toastError).toHaveBeenCalledWith({
      title: "Não foi possível atualizar o item. Tente novamente.",
    });
  });

  it("rolls back to the latest Realtime row when an edit fails", async () => {
    const user = userEvent.setup();
    let realtimeOptions:
      | {
          onChange: (updater: (items: Array<typeof arroz>) => Array<typeof arroz>) => void;
        }
      | undefined;
    let resolveUpdate!: (result: {
      status: "error";
      fieldErrors: Record<string, string>;
      message: string;
    }) => void;
    useListItemsRealtime.mockImplementation((options) => {
      realtimeOptions = options;
    });
    updateListItemAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<ListItemsPanel {...baseProps} items={[{ ...arroz, category: "mercado" }]} />);

    await user.click(screen.getByRole("button", { name: "Mercado" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));

    act(() => {
      realtimeOptions?.onChange((items) =>
        items.map((item) =>
          item.id === arroz.id ? { ...item, name: "Arroz integral", quantity: 3 } : item,
        ),
      );
    });

    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Categoria"), "farmacia");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateListItemAction).toHaveBeenCalled());
    expect(screen.queryByText("Arroz integral")).toBeNull();

    resolveUpdate({
      status: "error",
      fieldErrors: {},
      message: "Não foi possível atualizar o item. Tente novamente.",
    });

    await waitFor(() => expect(screen.getByText("Arroz integral")).not.toBeNull());
    expect(screen.getByText("Arroz integral").closest("li")?.textContent).toContain("3 kg");
    expect(screen.getByRole("dialog")).not.toBeNull();
  });

  it("finishes a category change under an active filter after the server confirms it", async () => {
    const user = userEvent.setup();
    updateListItemAction.mockResolvedValue({
      status: "success",
      fieldErrors: {},
      message: "Item atualizado.",
    });

    render(<ListItemsPanel {...baseProps} items={[{ ...arroz, category: "mercado" }]} />);

    await user.click(screen.getByRole("button", { name: "Mercado" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Categoria"), "farmacia");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("Arroz")).toBeNull();
    expect(screen.getByText("Nenhum item nesta categoria")).not.toBeNull();
    expect(toastSuccess).toHaveBeenCalledWith({ title: "Item atualizado." });
  });

  it("includes selected category when adding an item", async () => {
    const user = userEvent.setup();
    createListItemAction.mockImplementation(async () => ({
      status: "success",
      fieldErrors: {},
      message: "Item adicionado.",
    }));

    render(<ListItemsPanel {...baseProps} items={[]} />);

    await user.click(screen.getByRole("button", { name: "Adicionar item" }));
    await user.type(screen.getByLabelText("Nome"), "Sabonete");
    await user.selectOptions(screen.getByLabelText("Categoria"), "farmacia");
    await user.click(screen.getByRole("button", { name: "Adicionar item" }));

    expect(screen.getByText("Sabonete").closest("li")?.textContent).toContain("Farmácia");

    await waitFor(() => {
      expect(createListItemAction).toHaveBeenCalled();
    });
  });

  it("opens the add sheet from the empty state on a mobile viewport", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });

    render(<ListItemsPanel {...baseProps} items={[]} />);

    expect(screen.getByText("Sua lista está pronta para começar")).not.toBeNull();
    expect(screen.getByText(/solicitar uma estimativa de gasto/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Adicionar item" }).dataset.size).toBe("lg");

    await user.click(screen.getByRole("button", { name: "Adicionar primeiro item" }));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Adicionar item" })).not.toBeNull();
    expect(within(sheet).getByLabelText("Quantidade").getAttribute("inputmode")).toBe("decimal");
    expect(within(sheet).getByRole("button", { name: "Adicionar item" })).not.toBeNull();
  });

  it("replaces the empty state when the first categorized item arrives through Realtime", () => {
    let realtimeOptions:
      | {
          onChange: (updater: (items: Array<typeof arroz>) => Array<typeof arroz>) => void;
        }
      | undefined;
    useListItemsRealtime.mockImplementation((options) => {
      realtimeOptions = options;
    });

    render(<ListItemsPanel {...baseProps} items={[]} />);
    expect(screen.getByText("Sua lista está pronta para começar")).not.toBeNull();

    act(() => {
      realtimeOptions?.onChange(() => [{ ...arroz, category: "farmacia" }]);
    });

    expect(screen.queryByText("Sua lista está pronta para começar")).toBeNull();
    expect(screen.getByText("Arroz").closest("li")?.textContent).toContain("Farmácia");
  });

  it("keeps purchase, edit, and remove actions available on a mobile viewport", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });

    render(<ListItemsPanel {...baseProps} items={[arroz]} />);

    expect(screen.getByRole("checkbox", { name: "Marcar Arroz como comprado" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Editar" }).dataset.size).toBe("sm");
    expect(screen.getByRole("button", { name: "Remover" }).dataset.size).toBe("sm");
  });
});
