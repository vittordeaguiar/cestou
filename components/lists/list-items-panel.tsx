"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  LIST_ITEM_NAME_MAX_LENGTH,
  LIST_ITEM_UNIT_MAX_LENGTH,
  validateListItemInput,
  type ListItemFieldErrors,
} from "@/lib/lists/validation";
import { toast } from "@/lib/toast";

type ListItemsPanelProps = {
  groupId: string;
  items: ListItemRow[];
};

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

function AddItemForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
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
      router.refresh();
    }
  }, [router, state]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = validateListItemInput({
      name: data.get("name"),
      quantity: data.get("quantity"),
      unit: data.get("unit"),
    });
    setClientErrors(result.fieldErrors);
    if (!result.data) {
      event.preventDefault();
    }
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

function EditItemDialog({ groupId, item }: { groupId: string; item: ListItemRow }) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
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
      router.refresh();
    }
  }, [router, state]);

  useEffect(() => {
    if (state.status === "error" && state.message && Object.keys(state.fieldErrors).length === 0) {
      toast.error({ title: state.message });
    }
  }, [state]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = validateListItemInput({
      name: data.get("name"),
      quantity: data.get("quantity"),
      unit: data.get("unit"),
    });
    setClientErrors(result.fieldErrors);
    if (!result.data) {
      event.preventDefault();
    }
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

function DeleteItemDialog({ groupId, item }: { groupId: string; item: ListItemRow }) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState(
    deleteListItemAction,
    initialListItemActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success({ title: state.message ?? "Item removido." });
      closeRef.current?.click();
      router.refresh();
    }
  }, [router, state]);

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast.error({ title: state.message });
    }
  }, [state]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Trash2Icon data-icon="inline-start" />
          Remover
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover item</DialogTitle>
          <DialogDescription>
            “{item.name}” será removido da lista compartilhada. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="itemId" value={item.id} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <DialogClose ref={closeRef} className="sr-only">
              Fechar
            </DialogClose>
            <Button type="submit" variant="destructive" loading={pending}>
              {pending ? "Removendo…" : "Remover"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ListItemsPanel({ groupId, items }: ListItemsPanelProps) {
  return (
    <div className="grid gap-8">
      <AddItemForm groupId={groupId} />

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
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-body text-foreground truncate font-medium">{item.name}</p>
                  <p className="text-small text-muted-foreground">
                    {formatItemQuantity(item.quantity, item.unit)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <EditItemDialog groupId={groupId} item={item} />
                  <DeleteItemDialog groupId={groupId} item={item} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export { ListItemsPanel };
export type { ListItemsPanelProps };
