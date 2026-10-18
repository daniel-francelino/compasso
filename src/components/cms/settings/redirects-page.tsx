import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextField } from "@/components/shared/admin/form-fields";
import { IconButton } from "@/components/shared/admin/icon-button";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { redirectSchema } from "@/lib/cms/schemas";
import { deleteRedirect, listRedirects, saveRedirect } from "@/lib/cms/settings.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

function RedirectDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [permanent, setPermanent] = useState(true);
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      icon={Plus}
      title="Novo redirecionamento"
      submitLabel="Salvar"
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            redirectSchema,
            { from, to, permanent },
            (data) => saveRedirect({ data }),
            async () => {
              toast.success("Redirecionamento salvo.");
              await queryClient.invalidateQueries({ queryKey: QueryKey.Site.redirects() });
              onOpenChange(false);
            },
          );
        },
      }}
    >
      <TextField
        id="redirect-from"
        label="De"
        required
        value={from}
        onValueChange={setFrom}
        maxLength={200}
        error={errors["from"]}
        hint="Ex.: /servicos-antigos"
      />
      <TextField
        id="redirect-to"
        label="Para"
        required
        value={to}
        onValueChange={setTo}
        maxLength={500}
        error={errors["to"]}
        hint="Ex.: /servicos ou https://..."
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="redirect-permanent"
          checked={permanent}
          onCheckedChange={(checked) => setPermanent(checked === true)}
        />
        <Label htmlFor="redirect-permanent" className="font-normal">
          Permanente (301)
        </Label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}

export function RedirectsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  async function remove(id: string) {
    const result = await deleteRedirect({ data: { id } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: QueryKey.Site.redirects() });
  }
  const redirects = useQuery({
    queryKey: QueryKey.Site.redirects(),
    queryFn: async () => unwrapResult(await listRedirects()).redirects,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Redirecionamentos"
        description="Quando alguém abre um endereço antigo, o site leva para o novo."
        breadcrumbs={[{ label: "Redirecionamentos" }]}
        actions={
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> Novo redirecionamento
          </Button>
        }
      />
      {redirects.isPending ? <ListSkeleton rows={3} height="h-12" /> : null}
      {redirects.isError ? <p className="text-sm text-danger">{redirects.error.message}</p> : null}
      {redirects.data && redirects.data.length === 0 ? (
        <EmptyState
          title="Nenhum redirecionamento"
          description="Mudar o endereço de uma página no ar cria um automaticamente."
        />
      ) : null}
      {redirects.data && redirects.data.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {redirects.data.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0 truncate">
                {item.from} → {item.to}
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.permanent ? "301" : "302"}
                </span>
              </span>
              <IconButton
                label={`Excluir o redirecionamento de ${item.from}`}
                icon={Trash2}
                destructive
                onClick={() => void remove(item.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {creating ? <RedirectDialog onOpenChange={(open) => !open && setCreating(false)} /> : null}
    </div>
  );
}
