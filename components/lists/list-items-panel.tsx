"use client";

import {
  memo,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { PencilIcon, PlusIcon, ShoppingBasketIcon, Trash2Icon } from "lucide-react";

import {
  createListItemAction,
  deleteListItemAction,
  setListItemPurchasedAction,
  updateListItemAction,
} from "@/app/app/groups/list-items-actions";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldInput } from "@/components/ui/field-input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { initialListItemActionState } from "@/lib/auth/action-state";
import {
  CATEGORY_FILTER_OPTIONS,
  filterListItemsByCategory,
  formatItemCategory,
  ITEM_CATEGORIES,
  type CategoryFilter,
} from "@/lib/lists/category";
import { formatItemQuantity, partitionListItems, type ListItemRow } from "@/lib/lists/items";
import {
  formatAddedByLabel,
  mergeServerListItems,
  optimisticCreateItem,
  optimisticDeleteItem,
  optimisticSetPurchased,
  optimisticUpdateItem,
  serializeListItemsSnapshot,
} from "@/lib/lists/sync";
import { fetchListItemsSnapshot, useListItemsRealtime } from "@/lib/lists/use-list-items-realtime";
import {
  LIST_ITEM_NAME_MAX_LENGTH,
  LIST_ITEM_UNIT_MAX_LENGTH,
  validateListItemInput,
  type ListItemFieldErrors,
} from "@/lib/lists/validation";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ItemCategory } from "@/types";

type ListItemsPanelProps = {
  groupId: string;
  listId: string;
  currentUserId: string;
  memberNamesByUserId: Record<string, string | null>;
  items: ListItemRow[];
};

const REMOTE_HIGHLIGHT_MS = 1600;

function ItemFields({
  idPrefix,
  defaults,
  fieldErrors,
  pending,
}: {
  idPrefix: string;
  defaults?: { name?: string; quantity?: string; unit?: string; category?: ItemCategory | null };
  fieldErrors: ListItemFieldErrors;
  pending: boolean;
}) {
  const categoryId = `${idPrefix}-category`;
  const categoryDescriptionId = `${categoryId}-description`;
  const categoryErrorId = `${categoryId}-error`;
  const categoryDescribedBy = [categoryDescriptionId, fieldErrors.category ? categoryErrorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <fieldset disabled={pending} className="grid gap-4 disabled:opacity-100">
      <FieldInput
        id={`${idPrefix}-name`}
        name="name"
        label="Nome"
        defaultValue={defaults?.name}
        maxLength={LIST_ITEM_NAME_MAX_LENGTH}
        error={fieldErrors.name}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <FieldInput
          id={`${idPrefix}-quantity`}
          name="quantity"
          label="Quantidade"
          inputMode="decimal"
          defaultValue={defaults?.quantity ?? "1"}
          error={fieldErrors.quantity}
          required
        />
        <FieldInput
          id={`${idPrefix}-unit`}
          name="unit"
          label="Unidade"
          placeholder="kg, un…"
          defaultValue={defaults?.unit}
          maxLength={LIST_ITEM_UNIT_MAX_LENGTH}
          description="Opcional"
          error={fieldErrors.unit}
        />
      </div>
      <div className="group/field flex w-full flex-col gap-2">
        <Label htmlFor={categoryId}>Categoria</Label>
        <select
          id={categoryId}
          name="category"
          defaultValue={defaults?.category ?? ""}
          aria-describedby={categoryDescribedBy}
          aria-invalid={fieldErrors.category ? true : undefined}
          className={cn(
            "border-input bg-card text-body text-foreground h-11 min-h-11 w-full min-w-0 rounded-xl border px-3.5 py-2 shadow-xs transition-colors outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3",
            "disabled:bg-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
            fieldErrors.category && "border-destructive ring-destructive/20 ring-3",
          )}
        >
          <option value="">Sem categoria</option>
          {ITEM_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {formatItemCategory(category)}
            </option>
          ))}
        </select>
        <p id={categoryDescriptionId} className="text-caption text-muted-foreground">
          Opcional
        </p>
        {fieldErrors.category ? (
          <p id={categoryErrorId} role="alert" className="text-caption text-destructive">
            {fieldErrors.category}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}

function AddItemSheet({
  groupId,
  listId,
  currentUserId,
  setItems,
  trackLocalChange,
  setOpen,
  onRestoreFocus,
}: {
  groupId: string;
  listId: string;
  currentUserId: string;
  setItems: Dispatch<SetStateAction<ListItemRow[]>>;
  trackLocalChange: (itemId: string) => void;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onRestoreFocus: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const itemIdInputRef = useRef<HTMLInputElement>(null);
  const pendingItemIdRef = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(
    createListItemAction,
    initialListItemActionState,
  );
  const [clientErrors, setClientErrors] = useState<ListItemFieldErrors>({});
  const fieldErrors = { ...state.fieldErrors, ...clientErrors };

  useEffect(() => {
    if (state.status === "success") {
      toast.success({ title: state.message ?? "Item adicionado." });
      formRef.current?.reset();
      pendingItemIdRef.current = null;
      setOpen(false);
      return;
    }

    if (state.status === "error" && pendingItemIdRef.current) {
      const failedId = pendingItemIdRef.current;
      pendingItemIdRef.current = null;
      setItems((current) => optimisticDeleteItem(current, failedId));
      if (state.message && Object.keys(state.fieldErrors).length === 0) {
        toast.error({ title: state.message });
      }
    }
  }, [setItems, setOpen, state]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = validateListItemInput({
      name: data.get("name"),
      quantity: data.get("quantity"),
      unit: data.get("unit"),
      category: data.get("category"),
    });
    setClientErrors(result.fieldErrors);
    const validated = result.data;
    if (!validated) {
      event.preventDefault();
      return;
    }

    const itemId = crypto.randomUUID();
    if (itemIdInputRef.current) {
      itemIdInputRef.current.value = itemId;
    }
    pendingItemIdRef.current = itemId;
    trackLocalChange(itemId);

    setItems((current) =>
      optimisticCreateItem(current, {
        id: itemId,
        listId,
        name: validated.name,
        quantity: validated.quantity,
        unit: validated.unit,
        category: validated.category,
        purchased: false,
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  return (
    <Sheet
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && pending) {
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <SheetContent
        className="mx-auto w-full max-w-lg border-x"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <SheetHeader>
          <SheetTitle>Adicionar item</SheetTitle>
          <SheetDescription>Informe o item, a quantidade e os detalhes opcionais.</SheetDescription>
        </SheetHeader>
        <form
          ref={formRef}
          action={formAction}
          noValidate
          onSubmit={validateBeforeSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <input type="hidden" name="groupId" value={groupId} />
          <input ref={itemIdInputRef} type="hidden" name="itemId" defaultValue="" />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <ItemFields idPrefix="add-item" fieldErrors={fieldErrors} pending={pending} />
            {state.status === "error" && state.message ? (
              <p role="alert" className="text-small text-destructive mt-4">
                {state.message}
              </p>
            ) : null}
          </div>
          <SheetFooter className="shrink-0">
            <Button type="submit" className="w-full" loading={pending}>
              {pending ? "Adicionando…" : null}
              {!pending ? <PlusIcon data-icon="inline-start" /> : null}
              {!pending ? "Adicionar item" : null}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function EditItemDialog({
  groupId,
  item,
  setItems,
  trackLocalChange,
  onClose,
  onRestoreFocus,
}: {
  groupId: string;
  item: ListItemRow;
  setItems: Dispatch<SetStateAction<ListItemRow[]>>;
  trackLocalChange: (itemId: string) => void;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  const snapshotRef = useRef<ListItemRow | null>(null);
  const [state, formAction, pending] = useActionState(
    updateListItemAction,
    initialListItemActionState,
  );
  const [clientErrors, setClientErrors] = useState<ListItemFieldErrors>({});
  const fieldErrors = { ...state.fieldErrors, ...clientErrors };

  useEffect(() => {
    if (state.status === "success") {
      toast.success({ title: state.message ?? "Item atualizado." });
      snapshotRef.current = null;
      onClose();
      return;
    }

    if (state.status === "error" && snapshotRef.current) {
      const snapshot = snapshotRef.current;
      snapshotRef.current = null;
      setItems((current) =>
        optimisticUpdateItem(current, snapshot.id, {
          name: snapshot.name,
          quantity: snapshot.quantity,
          unit: snapshot.unit,
          category: snapshot.category,
        }),
      );
      if (state.message && Object.keys(state.fieldErrors).length === 0) {
        toast.error({ title: state.message });
      }
    }
  }, [onClose, setItems, state]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = validateListItemInput({
      name: data.get("name"),
      quantity: data.get("quantity"),
      unit: data.get("unit"),
      category: data.get("category"),
    });
    setClientErrors(result.fieldErrors);
    const validated = result.data;
    if (!validated) {
      event.preventDefault();
      return;
    }

    snapshotRef.current = item;
    trackLocalChange(item.id);
    setItems((current) =>
      optimisticUpdateItem(current, item.id, {
        name: validated.name,
        quantity: validated.quantity,
        unit: validated.unit,
        category: validated.category,
      }),
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Editar item</DialogTitle>
          <DialogDescription>
            Atualize o nome, a quantidade, a unidade ou a categoria.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} noValidate onSubmit={validateBeforeSubmit} className="grid gap-4">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="itemId" value={item.id} />
          <ItemFields
            idPrefix={`edit-${item.id}`}
            defaults={{
              name: item.name,
              quantity: String(item.quantity),
              unit: item.unit ?? "",
              category: item.category,
            }}
            fieldErrors={fieldErrors}
            pending={pending}
          />
          {state.status === "error" && state.message ? (
            <p role="alert" className="text-small text-destructive">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ListItemRowView = memo(function ListItemRowView({
  item,
  memberNamesByUserId,
  highlighted,
  toggling,
  deleting,
  onTogglePurchased,
  onEdit,
  onDelete,
}: {
  item: ListItemRow;
  memberNamesByUserId: Record<string, string | null>;
  highlighted: boolean;
  toggling: boolean;
  deleting: boolean;
  onTogglePurchased: (item: ListItemRow, purchased: boolean) => void;
  onEdit: (itemId: string, trigger: HTMLButtonElement) => void;
  onDelete: (item: ListItemRow) => void;
}) {
  const addedBy = formatAddedByLabel(item.createdBy, memberNamesByUserId);
  const checkboxLabel = item.purchased
    ? `Marcar ${item.name} como pendente`
    : `Marcar ${item.name} como comprado`;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-4 py-4 transition-colors duration-500 sm:flex-row sm:items-center sm:justify-between",
        highlighted ? "bg-accent/70" : "bg-transparent",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Checkbox
          checked={item.purchased}
          disabled={toggling}
          aria-label={checkboxLabel}
          className="mt-0.5"
          onCheckedChange={(value) => {
            if (value === "indeterminate") {
              return;
            }
            onTogglePurchased(item, value);
          }}
        />
        <div className="min-w-0 space-y-1">
          <p
            className={cn(
              "text-body truncate font-medium",
              item.purchased ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {item.name}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-small text-muted-foreground">
              {formatItemQuantity(item.quantity, item.unit)}
            </p>
            {item.category ? (
              <Badge variant="outline">{formatItemCategory(item.category)}</Badge>
            ) : null}
          </div>
          {addedBy ? <p className="text-caption text-muted-foreground">{addedBy}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-8 sm:pl-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(event) => onEdit(item.id, event.currentTarget)}
        >
          <PencilIcon data-icon="inline-start" />
          Editar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={deleting}
          onClick={() => onDelete(item)}
        >
          <Trash2Icon data-icon="inline-start" />
          Remover
        </Button>
      </div>
    </li>
  );
});

function ListItemsPanel({
  groupId,
  listId,
  currentUserId,
  memberNamesByUserId,
  items: serverItems,
}: ListItemsPanelProps) {
  const [items, setItems] = useState(serverItems);
  const [addOpen, setAddOpen] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListItemRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(() => new Set());
  const [purchasedOpen, setPurchasedOpen] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [, startDeleteTransition] = useTransition();
  const [, startPurchaseTransition] = useTransition();
  const highlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const localChangeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const localChangeIdsRef = useRef<Set<string>>(new Set());
  const togglingIdsRef = useRef<Set<string>>(new Set());
  const itemsHeadingRef = useRef<HTMLHeadingElement>(null);
  const addTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addFabRef = useRef<HTMLButtonElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const serverSnapshot = useMemo(() => serializeListItemsSnapshot(serverItems), [serverItems]);
  const lastSyncedSnapshotRef = useRef(serverSnapshot);
  const editTarget = useMemo(
    () => items.find((item) => item.id === editTargetId) ?? null,
    [editTargetId, items],
  );
  const { pending, purchased } = useMemo(() => {
    const partitioned = partitionListItems(items);
    return {
      pending: filterListItemsByCategory(partitioned.pending, categoryFilter),
      purchased: filterListItemsByCategory(partitioned.purchased, categoryFilter),
    };
  }, [categoryFilter, items]);
  const hasFilterMatches = pending.length > 0 || purchased.length > 0;

  useEffect(() => {
    if (serverSnapshot === lastSyncedSnapshotRef.current) {
      return;
    }

    lastSyncedSnapshotRef.current = serverSnapshot;
    setItems(serverItems);
  }, [serverItems, serverSnapshot]);

  useEffect(() => {
    const highlightTimers = highlightTimersRef.current;
    const localChangeTimers = localChangeTimersRef.current;
    const localChangeIds = localChangeIdsRef.current;
    const togglingIds = togglingIdsRef.current;
    return () => {
      highlightTimers.forEach((timer) => clearTimeout(timer));
      highlightTimers.clear();
      localChangeTimers.forEach((timer) => clearTimeout(timer));
      localChangeTimers.clear();
      localChangeIds.clear();
      togglingIds.clear();
    };
  }, []);

  const trackLocalChange = useCallback((itemId: string) => {
    localChangeIdsRef.current.add(itemId);

    const existingTimer = localChangeTimersRef.current.get(itemId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Ignore Realtime echo from our own mutation for a short window.
    const timer = setTimeout(() => {
      localChangeIdsRef.current.delete(itemId);
      localChangeTimersRef.current.delete(itemId);
    }, REMOTE_HIGHLIGHT_MS);

    localChangeTimersRef.current.set(itemId, timer);
  }, []);

  const catchUpFromServer = useCallback(async () => {
    const snapshot = await fetchListItemsSnapshot(listId);
    if (!snapshot) {
      return;
    }

    setItems((current) => mergeServerListItems(current, snapshot, localChangeIdsRef.current));
  }, [listId]);

  const togglePurchased = useCallback(
    (item: ListItemRow, nextPurchased: boolean) => {
      if (togglingIdsRef.current.has(item.id) || item.purchased === nextPurchased) {
        return;
      }

      const previousPurchased = item.purchased;
      togglingIdsRef.current.add(item.id);
      setTogglingIds((current) => {
        const next = new Set(current);
        next.add(item.id);
        return next;
      });
      trackLocalChange(item.id);
      setItems((current) => optimisticSetPurchased(current, item.id, nextPurchased));

      startPurchaseTransition(async () => {
        const formData = new FormData();
        formData.set("groupId", groupId);
        formData.set("itemId", item.id);
        formData.set("purchased", String(nextPurchased));

        try {
          const result = await setListItemPurchasedAction(initialListItemActionState, formData);

          if (result.status === "error") {
            setItems((current) => optimisticSetPurchased(current, item.id, previousPurchased));
            toast.error({ title: result.message ?? "Não foi possível atualizar o item." });
          }
        } catch {
          setItems((current) => optimisticSetPurchased(current, item.id, previousPurchased));
          toast.error({ title: "Não foi possível atualizar o item. Tente novamente." });
        } finally {
          togglingIdsRef.current.delete(item.id);
          setTogglingIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        }
      });
    },
    [groupId, startPurchaseTransition, trackLocalChange],
  );

  const closeEditDialog = useCallback(() => setEditTargetId(null), []);
  const openEditDialog = useCallback((itemId: string, trigger: HTMLButtonElement) => {
    editTriggerRef.current = trigger;
    setEditTargetId(itemId);
  }, []);
  const openAddSheet = useCallback((trigger: HTMLButtonElement) => {
    addTriggerRef.current = trigger;
    setAddOpen(true);
  }, []);
  const restoreEditFocus = useCallback(() => {
    const target = editTriggerRef.current?.isConnected
      ? editTriggerRef.current
      : itemsHeadingRef.current;
    target?.focus();
  }, []);
  const restoreAddFocus = useCallback(() => {
    const target = addTriggerRef.current?.isConnected
      ? addTriggerRef.current
      : (addFabRef.current ?? itemsHeadingRef.current);
    target?.focus();
  }, []);

  function confirmDelete() {
    if (!deleteTarget || deletingId) {
      return;
    }

    const snapshot = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(snapshot.id);
    trackLocalChange(snapshot.id);
    setItems((current) => optimisticDeleteItem(current, snapshot.id));

    startDeleteTransition(async () => {
      const formData = new FormData();
      formData.set("groupId", groupId);
      formData.set("itemId", snapshot.id);

      try {
        const result = await deleteListItemAction(initialListItemActionState, formData);

        if (result.status === "error") {
          setItems((current) => optimisticCreateItem(current, snapshot));
          toast.error({ title: result.message ?? "Não foi possível remover o item." });
          return;
        }

        toast.success({ title: result.message ?? "Item removido." });
      } catch {
        setItems((current) => optimisticCreateItem(current, snapshot));
        toast.error({ title: "Não foi possível remover o item. Tente novamente." });
      } finally {
        setDeletingId((current) => (current === snapshot.id ? null : current));
      }
    });
  }

  useListItemsRealtime({
    listId,
    onChange: setItems,
    onSubscribed: catchUpFromServer,
    onRemoteChange: (itemId) => {
      if (localChangeIdsRef.current.has(itemId)) {
        return;
      }

      setHighlightedIds((current) => {
        const next = new Set(current);
        next.add(itemId);
        return next;
      });

      const existingTimer = highlightTimersRef.current.get(itemId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        setHighlightedIds((current) => {
          const next = new Set(current);
          next.delete(itemId);
          return next;
        });
        highlightTimersRef.current.delete(itemId);
      }, REMOTE_HIGHLIGHT_MS);

      highlightTimersRef.current.set(itemId, timer);
    },
  });

  return (
    <div className="grid gap-8 pb-24">
      <section className="grid gap-3" aria-labelledby="items-heading">
        <div className="space-y-1">
          <h2
            ref={itemsHeadingRef}
            id="items-heading"
            tabIndex={-1}
            className="text-h3 text-foreground"
          >
            Itens
          </h2>
          <p className="text-small text-muted-foreground">
            Marque o que já foi comprado; o restante do grupo vê na hora.
          </p>
        </div>

        {items.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
            {CATEGORY_FILTER_OPTIONS.map((option) => {
              const selected = categoryFilter === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  aria-pressed={selected}
                  onClick={() => setCategoryFilter(option.value)}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBasketIcon className="size-8" />}
            title="Sua lista está pronta para começar"
            description="Adicione os primeiros itens agora. Quando a lista estiver pronta, você poderá solicitar uma estimativa de gasto."
            action={
              <Button type="button" onClick={(event) => openAddSheet(event.currentTarget)}>
                <PlusIcon data-icon="inline-start" />
                Adicionar primeiro item
              </Button>
            }
          />
        ) : !hasFilterMatches ? (
          <EmptyState
            title="Nenhum item nesta categoria"
            description="Tente outro filtro ou limpe a seleção em Todas."
          />
        ) : pending.length === 0 ? (
          <EmptyState
            title="Nada pendente"
            description="Todos os itens foram marcados como comprados."
          />
        ) : (
          <ul className="divide-border border-border divide-y rounded-2xl border">
            {pending.map((item) => (
              <ListItemRowView
                key={item.id}
                item={item}
                memberNamesByUserId={memberNamesByUserId}
                highlighted={highlightedIds.has(item.id)}
                toggling={togglingIds.has(item.id)}
                deleting={deletingId === item.id}
                onTogglePurchased={togglePurchased}
                onEdit={openEditDialog}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}
      </section>

      {purchased.length > 0 ? (
        <details
          open={purchasedOpen}
          className="grid gap-3"
          onToggle={(event) => setPurchasedOpen(event.currentTarget.open)}
        >
          <summary className="text-h3 text-foreground flex min-h-11 cursor-pointer items-center">
            Comprados ({purchased.length})
          </summary>
          <ul className="divide-border border-border divide-y rounded-2xl border">
            {purchased.map((item) => (
              <ListItemRowView
                key={item.id}
                item={item}
                memberNamesByUserId={memberNamesByUserId}
                highlighted={highlightedIds.has(item.id)}
                toggling={togglingIds.has(item.id)}
                deleting={deletingId === item.id}
                onTogglePurchased={togglePurchased}
                onEdit={openEditDialog}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        </details>
      ) : null}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Remover item</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” será removido da lista compartilhada. Esta ação não pode ser desfeita.`
                : "Este item será removido da lista compartilhada."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(deletingId)}
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={Boolean(deletingId)}
              onClick={confirmDelete}
            >
              {deletingId ? "Removendo…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editTarget ? (
        <EditItemDialog
          key={editTarget.id}
          groupId={groupId}
          item={editTarget}
          setItems={setItems}
          trackLocalChange={trackLocalChange}
          onClose={closeEditDialog}
          onRestoreFocus={restoreEditFocus}
        />
      ) : null}

      {addOpen ? (
        <AddItemSheet
          groupId={groupId}
          listId={listId}
          currentUserId={currentUserId}
          setItems={setItems}
          trackLocalChange={trackLocalChange}
          setOpen={setAddOpen}
          onRestoreFocus={restoreAddFocus}
        />
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-lg justify-end px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <Button
          ref={addFabRef}
          type="button"
          size="lg"
          className="pointer-events-auto shadow-lg"
          onClick={(event) => openAddSheet(event.currentTarget)}
        >
          <PlusIcon data-icon="inline-start" />
          Adicionar item
        </Button>
      </div>
    </div>
  );
}

export { ListItemsPanel };
export type { ListItemsPanelProps };
