// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, subscribe, on, channel, removeChannel } = vi.hoisted(() => {
  const subscribe = vi.fn((callback?: (status: string) => void) => {
    callback?.("SUBSCRIBED");
    return { unsubscribe: vi.fn() };
  });
  const on = vi.fn().mockReturnThis();
  const channel = vi.fn(() => ({ on, subscribe }));
  const removeChannel = vi.fn();
  const createClient = vi.fn(() => ({ channel, removeChannel }));
  return { createClient, subscribe, on, channel, removeChannel };
});

vi.mock("@/lib/supabase/client", () => ({ createClient }));

import { useListItemsRealtime } from "@/lib/lists/use-list-items-realtime";

describe("useListItemsRealtime", () => {
  afterEach(cleanup);

  beforeEach(() => {
    createClient.mockClear();
    channel.mockClear();
    on.mockClear();
    subscribe.mockClear();
    removeChannel.mockClear();
  });

  it("subscribes to list_items filtered by list id and cleans up", () => {
    const onChange = vi.fn();
    const onSubscribed = vi.fn();
    const { unmount } = renderHook(() =>
      useListItemsRealtime({ listId: "list-1", onChange, onSubscribed }),
    );

    expect(channel).toHaveBeenCalledWith("list-items:list-1");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "list_items",
        filter: "list_id=eq.list-1",
      },
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalled();
    expect(onSubscribed).toHaveBeenCalled();

    unmount();
    expect(removeChannel).toHaveBeenCalled();
  });

  it("applies realtime payloads through onChange", () => {
    const onChange = vi.fn();
    const onRemoteChange = vi.fn();

    renderHook(() =>
      useListItemsRealtime({ listId: "list-1", onChange, onRemoteChange }),
    );

    const handler = on.mock.calls[0]?.[2] as (payload: {
      eventType: string;
      new: Record<string, unknown>;
      old: null;
    }) => void;

    handler({
      eventType: "INSERT",
      new: {
        id: "11111111-1111-4111-8111-111111111111",
        list_id: "list-1",
        name: "Arroz",
        quantity: 1,
        unit: null,
        created_by: "user-1",
        created_at: "2026-08-08T12:00:00.000Z",
      },
      old: null,
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const updater = onChange.mock.calls[0]?.[0] as (items: unknown[]) => unknown[];
    expect(updater([])).toHaveLength(1);
    expect(onRemoteChange).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });
});
