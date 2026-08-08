"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  createListItemAction,
  deleteListItemAction,
  updateListItemAction,
} from "@/app/app/groups/list-items-actions";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldInput } from "@/components/ui/field-input";
import { initialListItemActionState } from "@/lib/auth/action-state";
import { formatItemQuantity, type ListItemRow } from "@/lib/lists/items";
import {
  formatAddedByLabel,
  mergeServerListItems,
  optimisticCreateItem,
  optimisticDeleteItem,
  optimisticUpdateItem,
  serializeListItemsSnapshot,
} from "@/lib/lists/sync";
import {
  fetchListItemsSnapshot,
  useListItemsRealtime,
} from "@/lib/lists/use-list-items-realtime";
import {
  LIST_ITEM_NAME_MAX_LENGTH,
  LIST_ITEM_UNIT_MAX_LENGTH,
  validateListItemInput,
  type ListItemFieldErrors,
} from "@/lib/lists/validation";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

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
  defaults?: { name?: string; quantity?: string; unit?: string };
  fieldErrors: ListItemFieldErrors;
  pending: boolean;
}) {
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
    </fieldset>
  );
}

function AddItemForm({
  groupId,
  listId,
  currentUserId,
  setItems,
  trackLocalChange,
}: {
  groupId: string;
  listId: string;
  currentUserId: string;
  setItems: Dispatch<SetStateAction<ListItemRow[]>>;
  trackLocalChange: (itemId: string) => void;
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
  }, [setItems, state]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = validateListItemInput({
      name: data.get("name"),
      quantity: data.get("quantity"),
      unit: data.get("unit"),
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
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      onSubmit={validateBeforeSubmit}
      className="border-border grid gap-4 rounded-2xl border p-4"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input ref={itemIdInputRef} type="hidden" name="itemId" defaultValue="" />
      <div className="space-y-1">
        <h2 className="text-h3 text-foreground">Adicionar item</h2>
        <p className="text-small text-muted-foreground">
          Nome obrigatório e quantidade maior que zero.
        </p>
      </div>
      <ItemFields idPrefix="add-item" fieldErrors={fieldErrors} pending={pending} />
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-small text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full sm:w-auto" loading={pending}>
        {pending ? "Adicionando…" : null}
        {!pending ? <PlusIcon data-icon="inline-start" /> : null}
        {!pending ? "Adicionar item" : null}
      </Button>
    </form>
  );
}

function EditItemDialog({
  groupId,
  item,
  setItems,
  trackLocalChange,
}: {
  groupId: string;
  item: ListItemRow;
  setItems: Dispatch<SetStateAction<ListItemRow[]>>;
  trackLocalChange: (itemId: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
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
      closeRef.current?.click();
      snapshotRef.current = null;
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
        }),
      );
      if (state.message && Object.keys(state.fieldErrors).length === 0) {
        toast.error({ title: state.message });
      }
    }
  }, [setItems, state]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = validateListItemInput({
      name: data.get("name"),
      quantity: data.get("quantity"),
      unit: data.get("unit"),
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
      }),
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PencilIcon data-icon="inline-start" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar item</DialogTitle>
          <DialogDescription>Atualize o nome, a quantidade ou a unidade.</DialogDescription>
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
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <DialogClose ref={closeRef} className="sr-only">
              Fechar
            </DialogClose>
            <Button type="submit" loading={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ListItemsPanel({
  groupId,
  listId,
  currentUserId,
  memberNamesByUserId,
  items: serverItems,
}: ListItemsPanelProps) {
  const [items, setItems] = useState(serverItems);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<ListItemRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();
  const highlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const localChangeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const localChangeIdsRef = useRef<Set<string>>(new Set());
  const serverSnapshot = serializeListItemsSnapshot(serverItems);
  const lastSyncedSnapshotRef = useRef(serverSnapshot);

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
    return () => {
      highlightTimers.forEach((timer) => clearTimeout(timer));
      highlightTimers.clear();
      localChangeTimers.forEach((timer) => clearTimeout(timer));
      localChangeTimers.clear();
      localChangeIds.clear();
    };
  }, []);

  function trackLocalChange(itemId: string) {
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
  }

  async function catchUpFromServer() {
    const snapshot = await fetchListItemsSnapshot(listId);
    if (!snapshot) {
      return;
    }

    setItems((current) => mergeServerListItems(current, snapshot, localChangeIdsRef.current));
  }

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
    <div className="grid gap-8">
      <AddItemForm
        groupId={groupId}
        listId={listId}
        currentUserId={currentUserId}
        setItems={setItems}
        trackLocalChange={trackLocalChange}
      />

      <section className="grid gap-3" aria-labelledby="items-heading">
        <div className="space-y-1">
          <h2 id="items-heading" className="text-h3 text-foreground">
            Itens
          </h2>
          <p className="text-small text-muted-foreground">
            Todos os membros do grupo podem adicionar, editar e remover.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Lista vazia"
            description="Adicione o primeiro item para começar a organizar as compras."
          />
        ) : (
          <ul className="divide-border border-border divide-y rounded-2xl border">
            {items.map((item) => {
              const addedBy = formatAddedByLabel(item.createdBy, memberNamesByUserId);

              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-3 px-4 py-4 transition-colors duration-500 sm:flex-row sm:items-center sm:justify-between",
                    highlightedIds.has(item.id) ? "bg-accent/70" : "bg-transparent",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-body text-foreground truncate font-medium">{item.name}</p>
                    <p className="text-small text-muted-foreground">
                      {formatItemQuantity(item.quantity, item.unit)}
                    </p>
                    {addedBy ? (
                      <p className="text-caption text-muted-foreground">{addedBy}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <EditItemDialog
                      groupId={groupId}
                      item={item}
                      setItems={setItems}
                      trackLocalChange={trackLocalChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={deletingId === item.id}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      Remover
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent>
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
    </div>
  );
}

export { ListItemsPanel };
export type { ListItemsPanelProps };
