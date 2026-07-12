import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, revalidatePath } = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { updateProfileNameAction } from "@/app/profile/actions";
import { initialProfileActionState } from "@/lib/auth/action-state";

function formData(name: string): FormData {
  const data = new FormData();
  data.set("name", name);
  return data;
}

describe("profile server action", () => {
  beforeEach(() => {
    createClient.mockReset();
    revalidatePath.mockReset();
  });

  it("updates only the verified subject profile", async () => {
    const single = vi.fn().mockResolvedValue({ data: { display_name: "Ana Maria" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null }),
      },
      from,
    });

    await expect(
      updateProfileNameAction(initialProfileActionState, formData("  Ana   Maria  ")),
    ).resolves.toEqual({
      status: "success",
      name: "Ana Maria",
      fieldErrors: {},
    });

    expect(update).toHaveBeenCalledWith({ display_name: "Ana Maria" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("does not update when no verified subject exists", async () => {
    const from = vi.fn();
    createClient.mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }) },
      from,
    });

    await expect(
      updateProfileNameAction(initialProfileActionState, formData("Ana")),
    ).resolves.toMatchObject({
      status: "error",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
