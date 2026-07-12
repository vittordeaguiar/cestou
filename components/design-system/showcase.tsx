"use client";

import { useId, useState } from "react";
import { PlusIcon, ShoppingBasketIcon, Trash2Icon } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "@/lib/toast";

const COLOR_TOKENS = [
  { name: "Background", token: "background", className: "bg-background" },
  { name: "Foreground", token: "foreground", className: "bg-foreground" },
  { name: "Card", token: "card", className: "bg-card" },
  { name: "Primary", token: "primary", className: "bg-primary" },
  { name: "Secondary", token: "secondary", className: "bg-secondary" },
  { name: "Muted", token: "muted", className: "bg-muted" },
  { name: "Accent", token: "accent", className: "bg-accent" },
  { name: "Destructive", token: "destructive", className: "bg-destructive" },
  { name: "Success", token: "success", className: "bg-success" },
  { name: "Warning", token: "warning", className: "bg-warning" },
  { name: "Info", token: "info", className: "bg-info" },
  { name: "Border", token: "border", className: "bg-border" },
  { name: "Ring", token: "ring", className: "bg-ring" },
] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-border/70 scroll-mt-20 space-y-4 border-b pb-10">
      <div className="space-y-1">
        <h2 className="text-h2 text-foreground">{title}</h2>
        <p className="text-small text-muted-foreground max-w-2xl">{description}</p>
      </div>
      {children}
    </section>
  );
}

function DesignSystemShowcase() {
  const checkboxId = useId();
  const [checked, setChecked] = useState(true);

  return (
    <div className="bg-background text-foreground min-h-full">
      <header className="safe-pt border-border/80 bg-card/90 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-caption text-muted-foreground tracking-[0.08em] uppercase">
              Interno · desenvolvimento
            </p>
            <h1 className="text-h1 text-foreground">Design System</h1>
          </div>
          <p className="text-caption text-muted-foreground max-w-sm sm:text-right">
            Showcase visual. Indisponível em produção (`notFound`).
          </p>
        </div>
      </header>

      <main className="safe-pb mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6">
        <Section
          id="tokens"
          title="Cores e tokens"
          description="Tokens semânticos em variáveis CSS, mapeados no Tailwind via @theme inline."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {COLOR_TOKENS.map((swatch) => (
              <div
                key={swatch.token}
                className="border-border bg-card overflow-hidden rounded-xl border shadow-xs"
              >
                <div className={`border-border/60 h-16 border-b ${swatch.className}`} />
                <div className="space-y-0.5 p-3">
                  <p className="text-label text-foreground">{swatch.name}</p>
                  <p className="text-caption text-muted-foreground font-mono">--{swatch.token}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="typography"
          title="Tipografia"
          description="Hierarquia Geist para leitura confortável no celular."
        >
          <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-sm">
            <p className="text-display">Display — organizar juntos</p>
            <p className="text-h1">Heading 1 — lista compartilhada</p>
            <p className="text-h2">Heading 2 — itens da semana</p>
            <p className="text-h3">Heading 3 — detalhes do grupo</p>
            <p className="text-body">
              Body — texto principal com boa legibilidade em telas estreitas.
            </p>
            <p className="text-small">Small — apoio e metadados secundários.</p>
            <p className="text-caption">Caption — legendas e dicas curtas.</p>
            <p className="text-label">Label — rótulos de formulário e ações.</p>
          </div>
        </Section>

        <Section
          id="button"
          title="Button"
          description="Variantes principais com altura mínima de 44px e suporte a loading/ícone."
        >
          <div className="flex flex-wrap gap-3">
            <Button>
              <PlusIcon data-icon="inline-start" />
              Primary
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">
              <Trash2Icon data-icon="inline-start" />
              Destructive
            </Button>
            <Button loading>Salvando</Button>
            <Button disabled>Disabled</Button>
            <Button size="icon" aria-label="Adicionar item">
              <PlusIcon />
            </Button>
          </div>
        </Section>

        <Section
          id="input"
          title="Input"
          description="Campo com label, descrição, erro e aria-describedby."
        >
          <div className="grid max-w-md gap-5">
            <FieldInput
              id="item-name"
              label="Nome do item"
              description="Use um nome curto e reconhecível."
              placeholder="Ex.: Arroz 5kg"
            />
            <FieldInput
              id="item-error"
              label="Quantidade"
              defaultValue="abc"
              error="Informe um número válido."
            />
            <FieldInput id="item-disabled" label="Unidade" defaultValue="kg" disabled />
          </div>
        </Section>

        <Section
          id="card"
          title="Card"
          description="Composição flexível com header, content e footer."
        >
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Mercado da semana</CardTitle>
              <CardDescription>Grupo Casa · 8 itens pendentes</CardDescription>
            </CardHeader>
            <CardContent className="text-small text-muted-foreground">
              Estimativa aproximada com base nos preços recentes do grupo.
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <Badge variant="success">Ativa</Badge>
              <Button size="sm">Abrir lista</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section
          id="overlays"
          title="Dialog e Sheet"
          description="Foco controlado, fechamento por teclado e área de toque adequada no botão fechar."
        >
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Abrir dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar remoção</DialogTitle>
                  <DialogDescription>
                    O item será removido da lista compartilhada. Esta ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive">Remover</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button>Abrir sheet</Button>
              </SheetTrigger>
              <SheetContent side="bottom">
                <SheetHeader>
                  <SheetTitle>Ações rápidas</SheetTitle>
                  <SheetDescription>
                    Sheet otimizado para gestos e ações no celular.
                  </SheetDescription>
                </SheetHeader>
                <div className="grid gap-2 px-4">
                  <Button variant="secondary" className="justify-start">
                    <PlusIcon data-icon="inline-start" />
                    Adicionar item
                  </Button>
                  <Button variant="outline" className="justify-start">
                    Compartilhar lista
                  </Button>
                </div>
                <SheetFooter>
                  <Button variant="ghost" className="w-full">
                    Fechar
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </Section>

        <Section
          id="checkbox-badge"
          title="Checkbox e Badge"
          description="Estados acessíveis e variantes alinhadas aos tokens."
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Checkbox
                id={checkboxId}
                checked={checked}
                onCheckedChange={(value) => setChecked(value === true)}
              />
              <Label htmlFor={checkboxId}>Marcar item como comprado</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Sucesso</Badge>
              <Badge variant="warning">Aviso</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="destructive">Erro</Badge>
            </div>
          </div>
        </Section>

        <Section
          id="toast"
          title="Toast"
          description="Sucesso, erro, aviso e informação via Sonner + tokens Cestou."
        >
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() =>
                toast.success({
                  title: "Item adicionado",
                  description: "Arroz 5kg entrou na lista.",
                })
              }
            >
              Sucesso
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.error({
                  title: "Falha ao salvar",
                  description: "Verifique a conexão e tente de novo.",
                })
              }
            >
              Erro
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.warning({
                  title: "Preço desatualizado",
                  description: "A estimativa pode estar imprecisa.",
                })
              }
            >
              Aviso
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                toast.info({
                  title: "Convite pendente",
                  description: "Há um membro aguardando aceite.",
                })
              }
            >
              Info
            </Button>
          </div>
        </Section>

        <Section
          id="feedback"
          title="Estados de interface"
          description="Loading, erro e vazio reutilizáveis com ação opcional."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <LoadingState description="Buscando itens da lista…" />
            <ErrorState
              action={
                <Button variant="outline" size="sm">
                  Tentar novamente
                </Button>
              }
            />
            <EmptyState
              icon={<ShoppingBasketIcon className="size-8" />}
              title="Lista vazia"
              description="Adicione o primeiro item para começar."
              action={
                <Button size="sm">
                  <PlusIcon data-icon="inline-start" />
                  Adicionar item
                </Button>
              }
            />
          </div>
        </Section>

        <Section
          id="responsive"
          title="Larguras de referência"
          description="Exemplos em faixas próximas a 320, 375, 768 e 1280 px. Evite overflow horizontal."
        >
          <div className="space-y-4 overflow-x-auto">
            {[
              { label: "~320px", width: "w-[320px]" },
              { label: "~375px", width: "w-[375px]" },
              { label: "~768px", width: "w-[768px] max-w-full" },
            ].map((frame) => (
              <div key={frame.label} className="space-y-2">
                <p className="text-caption text-muted-foreground">{frame.label}</p>
                <div
                  className={`${frame.width} border-border bg-muted/20 rounded-2xl border border-dashed p-3`}
                >
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle>Preview mobile</CardTitle>
                      <CardDescription>Layout fluido sem scroll lateral.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full">Continuar</Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <p className="text-caption text-muted-foreground">~1280px (conteúdo max-w-5xl)</p>
              <div className="border-border bg-muted/20 grid gap-3 rounded-2xl border border-dashed p-4 md:grid-cols-3">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Coluna A</CardTitle>
                  </CardHeader>
                  <CardContent className="text-small text-muted-foreground">
                    Desktop usa mais colunas sem perder a base mobile.
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Coluna B</CardTitle>
                  </CardHeader>
                  <CardContent className="text-small text-muted-foreground">
                    Tokens e tipografia permanecem consistentes.
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Coluna C</CardTitle>
                  </CardHeader>
                  <CardContent className="text-small text-muted-foreground">
                    Controles mantêm área de toque generosa.
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}

export { DesignSystemShowcase };
