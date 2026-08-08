"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { leaveGroupAction, removeGroupMemberAction } from "@/app/app/groups/members-actions";
import { Badge } from "@/components/ui/badge";
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
import { initialMemberActionState } from "@/lib/auth/action-state";
import {
  formatMemberDisplayName,
  type GroupMemberRow,
  type PendingGroupInvite,
} from "@/lib/groups/membership";
import { toast } from "@/lib/toast";

type GroupMembersPanelProps = {
  groupId: string;
  currentUserId: string;
  currentRole: "owner" | "member";
  members: GroupMemberRow[];
  pendingInvites: PendingGroupInvite[];
};

function ConfirmActionDialog({
  triggerLabel,
  triggerVariant = "outline",
  title,
  description,
  confirmLabel,
  confirmVariant = "destructive",
  action,
  hiddenFields,
}: {
  triggerLabel: string;
  triggerVariant?: "outline" | "destructive" | "secondary";
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "destructive" | "default";
  action: (
    state: typeof initialMemberActionState,
    formData: FormData,
  ) => Promise<typeof initialMemberActionState>;
  hiddenFields: Record<string, string>;
}) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState(action, initialMemberActionState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success({ title: state.message ?? "Alteração salva." });
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
        <Button type="button" variant={triggerVariant} size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <DialogClose ref={closeRef} className="sr-only">
              Fechar
            </DialogClose>
            <Button type="submit" variant={confirmVariant} loading={pending}>
              {pending ? `${confirmLabel}…` : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GroupMembersPanel({
  groupId,
  currentUserId,
  currentRole,
  members,
  pendingInvites,
}: GroupMembersPanelProps) {
  const isOwner = currentRole === "owner";

  return (
    <div className="grid gap-8">
      <section className="grid gap-3" aria-labelledby="members-heading">
        <div className="space-y-1">
          <h2 id="members-heading" className="text-h3 text-foreground">
            Membros
          </h2>
          <p className="text-small text-muted-foreground">
            Quem já faz parte deste grupo e pode ver a lista compartilhada.
          </p>
        </div>

        <ul className="divide-border border-border divide-y rounded-2xl border">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            const label = formatMemberDisplayName(member.displayName);

            return (
              <li
                key={member.membershipId}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-body text-foreground truncate font-medium">
                    {label}
                    {isCurrentUser ? (
                      <span className="text-muted-foreground font-normal"> (você)</span>
                    ) : null}
                  </p>
                  <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                    {member.role === "owner" ? "Responsável" : "Membro"}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {isOwner && member.role === "member" ? (
                    <ConfirmActionDialog
                      triggerLabel="Remover"
                      triggerVariant="outline"
                      title="Remover membro"
                      description={`${label} deixará de ver a lista e os dados deste grupo.`}
                      confirmLabel="Remover"
                      action={removeGroupMemberAction}
                      hiddenFields={{ groupId, memberUserId: member.userId }}
                    />
                  ) : null}

                  {!isOwner && isCurrentUser ? (
                    <ConfirmActionDialog
                      triggerLabel="Sair do grupo"
                      triggerVariant="destructive"
                      title="Sair do grupo"
                      description="Você perderá o acesso à lista compartilhada. Para voltar, precisará de um novo convite."
                      confirmLabel="Sair do grupo"
                      action={leaveGroupAction}
                      hiddenFields={{ groupId }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {isOwner ? (
        <section className="grid gap-3" aria-labelledby="invites-heading">
          <div className="space-y-1">
            <h2 id="invites-heading" className="text-h3 text-foreground">
              Convites pendentes
            </h2>
            <p className="text-small text-muted-foreground">
              Convites ainda não aceitos. O envio de novos convites chega em uma próxima etapa.
            </p>
          </div>

          {pendingInvites.length === 0 ? (
            <div className="border-border bg-muted/30 rounded-2xl border border-dashed px-4 py-8 text-center">
              <p className="text-body text-foreground">Nenhum convite pendente</p>
              <p className="text-small text-muted-foreground mt-1">
                Quando houver convites abertos, eles aparecerão aqui.
              </p>
            </div>
          ) : (
            <ul className="divide-border border-border divide-y rounded-2xl border">
              {pendingInvites.map((invite) => (
                <li key={invite.id} className="flex flex-col gap-1 px-4 py-4">
                  <p className="text-body text-foreground font-medium">{invite.email}</p>
                  <p className="text-caption text-muted-foreground">
                    Expira em{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(invite.expiresAt))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

export { GroupMembersPanel };
export type { GroupMembersPanelProps };
