import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createClient, estimatePendingItems, revalidatePath } = vi.hoisted(
  () => ({
    createAdminClient: vi.fn(),
    createClient: vi.fn(),
    estimatePendingItems: vi.fn(),
    revalidatePath: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/pricing/estimate", () => ({ estimatePendingItems }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { requestPriceEstimateAction } from "@/app/app/groups/price-estimate-actions";
import { initialPriceEstimateActionState } from "@/lib/pricing/action-state";

const GROUP_ID = "10000000-0000-4000-8000-000000000001";
const LIST_ID = "20000000-0000-4000-8000-000000000001";
const USER_ID = "30000000-0000-4000-8000-000000000001";

function formData(groupId = GROUP_ID) {
  const data = new FormData();
  data.set("groupId", groupId);
  return data;
}

function mockClient(options: {
  lockAcquired?: boolean;
  membershipGroupId?: string;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string | null;
    category: "mercado" | "farmacia" | "outro" | null;
  }>;
  finishError?: unknown;
}) {
  const membershipGroupId = options.membershipGroupId ?? GROUP_ID;
  const items = options.items ?? [
    {
      id: "40000000-0000-4000-8000-000000000001",
      name: "Arroz",
      quantity: 2,
      unit: "kg",
      category: "mercado" as const,
    },
  ];
  const rpc = vi.fn((name: string) => {
    if (name === "acquire_price_estimate_lock") {
      return Promise.resolve({ data: options.lockAcquired ?? true, error: null });
    }
    if (name === "finish_price_estimate") {
      return Promise.resolve({ data: null, error: options.finishError ?? null });
    }
    if (name === "release_price_estimate_lock") {
      return Promise.resolve({ data: null, error: null });
    }
    throw new Error(`RPC inesperada: ${name}`);
  });

  createClient.mockResolvedValue({
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { sub: USER_ID } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "group_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { group_id: membershipGroupId, role: "owner" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "groups") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: membershipGroupId, name: "Casa" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "lists") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: LIST_ID },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "list_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: items, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Tabela inesperada: ${table}`);
    }),
  });
  createAdminClient.mockReturnValue({ rpc });

  return { rpc };
}

describe("requestPriceEstimateAction", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    createClient.mockReset();
    estimatePendingItems.mockReset();
    revalidatePath.mockReset();
  });

  it("rejeita grupo inválido antes de consultar o banco", async () => {
    await expect(
      requestPriceEstimateAction(initialPriceEstimateActionState, formData("inválido")),
    ).resolves.toMatchObject({ status: "error", message: "Grupo inválido." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("relê itens pendentes, persiste o resultado e retorna sucesso", async () => {
    const { rpc } = mockClient({});
    estimatePendingItems.mockResolvedValue({
      status: "complete",
      totalAmount: 20,
      itemsNotFound: [],
      processedCount: 1,
      failedCount: 0,
    });

    await expect(
      requestPriceEstimateAction(initialPriceEstimateActionState, formData()),
    ).resolves.toEqual({
      status: "success",
      message: "Estimativa atualizada.",
      estimatedTotal: 20,
      itemsProcessed: 1,
      itemsNotFound: 0,
    });

    expect(estimatePendingItems).toHaveBeenCalledWith([
      {
        id: "40000000-0000-4000-8000-000000000001",
        name: "Arroz",
        quantity: 2,
        unit: "kg",
        category: "mercado",
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("acquire_price_estimate_lock", {
      target_list_id: LIST_ID,
      lock_token: expect.any(String),
      requested_by: USER_ID,
    });
    expect(rpc).toHaveBeenCalledWith("finish_price_estimate", {
      target_list_id: LIST_ID,
      lock_token: expect.any(String),
      estimated_total: 20,
      missing_items: [],
      requested_by: USER_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/app/groups/${GROUP_ID}/list`);
  });

  it("retorna resultado parcial e persiste itens não encontrados", async () => {
    mockClient({});
    estimatePendingItems.mockResolvedValue({
      status: "partial",
      totalAmount: 10,
      itemsNotFound: ["Arroz"],
      processedCount: 1,
      failedCount: 0,
    });

    await expect(
      requestPriceEstimateAction(initialPriceEstimateActionState, formData()),
    ).resolves.toMatchObject({
      status: "partial",
      estimatedTotal: 10,
      itemsProcessed: 1,
      itemsNotFound: 1,
    });
  });

  it("não inicia outra execução enquanto a lista já está bloqueada", async () => {
    mockClient({ lockAcquired: false });

    await expect(
      requestPriceEstimateAction(initialPriceEstimateActionState, formData()),
    ).resolves.toMatchObject({
      status: "rate_limited",
      message: "Uma estimativa desta lista já está em andamento.",
    });
    expect(estimatePendingItems).not.toHaveBeenCalled();
  });

  it("retorna erro seguro quando o cliente privilegiado não está configurado", async () => {
    mockClient({});
    createAdminClient.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY=secret");
    });

    const result = await requestPriceEstimateAction(initialPriceEstimateActionState, formData());

    expect(result).toMatchObject({
      status: "error",
      message: "Não foi possível iniciar a estimativa. Tente novamente.",
    });
    expect(result.message).not.toContain("secret");
  });

  it("não chama provedores quando não há itens pendentes", async () => {
    const { rpc } = mockClient({ items: [] });

    await expect(
      requestPriceEstimateAction(initialPriceEstimateActionState, formData()),
    ).resolves.toMatchObject({
      status: "error",
      message: "Adicione ao menos um item pendente antes de solicitar a estimativa.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(estimatePendingItems).not.toHaveBeenCalled();
  });

  it("bloqueia acesso a um grupo diferente do vínculo da sessão", async () => {
    mockClient({ membershipGroupId: "10000000-0000-4000-8000-000000000099" });

    await expect(
      requestPriceEstimateAction(initialPriceEstimateActionState, formData()),
    ).resolves.toMatchObject({
      status: "error",
      message: "Você não faz parte deste grupo.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(estimatePendingItems).not.toHaveBeenCalled();
  });

  it("libera o lock e esconde detalhes quando a integração falha", async () => {
    const { rpc } = mockClient({});
    estimatePendingItems.mockRejectedValue(new Error("secret-provider-payload"));

    const result = await requestPriceEstimateAction(initialPriceEstimateActionState, formData());

    expect(result).toMatchObject({
      status: "error",
      message: "Não foi possível calcular a estimativa agora. Tente novamente.",
    });
    expect(result.message).not.toContain("secret-provider-payload");
    expect(rpc).toHaveBeenCalledWith("release_price_estimate_lock", {
      target_list_id: LIST_ID,
      lock_token: expect.any(String),
      requested_by: USER_ID,
    });
  });

  it("libera o lock quando a persistência atômica falha", async () => {
    const { rpc } = mockClient({ finishError: { code: "P0001" } });
    estimatePendingItems.mockResolvedValue({
      status: "complete",
      totalAmount: 20,
      itemsNotFound: [],
      processedCount: 1,
      failedCount: 0,
    });

    await expect(
      requestPriceEstimateAction(initialPriceEstimateActionState, formData()),
    ).resolves.toMatchObject({
      status: "error",
      message: "A estimativa foi calculada, mas não pôde ser salva. Tente novamente.",
    });
    expect(rpc).toHaveBeenCalledWith("release_price_estimate_lock", {
      target_list_id: LIST_ID,
      lock_token: expect.any(String),
      requested_by: USER_ID,
    });
  });

  it("bloqueia usuário sem sessão", async () => {
    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
      },
    });

    await expect(
      requestPriceEstimateAction(initialPriceEstimateActionState, formData()),
    ).resolves.toMatchObject({
      status: "error",
      message: "Sua sessão expirou. Entre novamente para continuar.",
    });
  });
});
