"use client";

import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import type { ListItemRow } from "@/lib/lists/items";
import {
  applyListItemChange,
  type ListItemChangeEvent,
  type ListItemRealtimePayload,
} from "@/lib/lists/sync";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type ListItemDbRow = Database["public"]["Tables"]["list_items"]["Row"];

type UseListItemsRealtimeOptions = {
  listId: string;
  onChange: (updater: (items: ListItemRow[]) => ListItemRow[]) => void;
  onRemoteChange?: (itemId: string) => void;
};

function toSyncPayload(
  payload: RealtimePostgresChangesPayload<ListItemDbRow>,
): ListItemRealtimePayload | null {
  const eventType = payload.eventType as ListItemChangeEvent;
  if (eventType !== "INSERT" && eventType !== "UPDATE" && eventType !== "DELETE") {
    return null;
  }

  return {
    eventType,
    new: payload.new && typeof payload.new === "object" ? (payload.new as Record<string, unknown>) : null,
    old: payload.old && typeof payload.old === "object" ? (payload.old as Record<string, unknown>) : null,
  };
}

function changedItemId(payload: ListItemRealtimePayload): string | null {
  if (payload.eventType === "DELETE") {
    return typeof payload.old?.id === "string" ? payload.old.id : null;
  }

  return typeof payload.new?.id === "string" ? payload.new.id : null;
}

/**
 * Subscribes to postgres_changes on list_items for the group's active list.
 */
export function useListItemsRealtime({
  listId,
  onChange,
  onRemoteChange,
}: UseListItemsRealtimeOptions) {
  const onChangeRef = useRef(onChange);
  const onRemoteChangeRef = useRef(onRemoteChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);

  useEffect(() => {
    if (!listId) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`list-items:${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "list_items",
          filter: `list_id=eq.${listId}`,
        },
        (payload: RealtimePostgresChangesPayload<ListItemDbRow>) => {
          const syncPayload = toSyncPayload(payload);
          if (!syncPayload) {
            return;
          }

          onChangeRef.current((items) => applyListItemChange(items, syncPayload));

          const itemId = changedItemId(syncPayload);
          if (itemId) {
            onRemoteChangeRef.current?.(itemId);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [listId]);
}
