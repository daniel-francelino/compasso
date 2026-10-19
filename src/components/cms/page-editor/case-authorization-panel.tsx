import { ShieldOff, ShieldCheck } from "lucide-react";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { TextAreaField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Button } from "@/components/shared/ui/button";
import {
  authorizeCaseStudy,
  getCaseAuthorization,
  withdrawCaseStudy,
} from "@/lib/cms/content.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { formatDate } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function CaseAuthorizationPanel({ pageId, canEdit }: { pageId: string; canEdit: boolean }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [brandId, setBrandId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSeeBrands = can(auth, Action.Brands.View);

  const authorization = useQuery({
    queryKey: QueryKey.Site.authorization(pageId),
    queryFn: async () =>
      unwrapResult(await getCaseAuthorization({ data: { pageId } })).authorization,
  });
  const brands = useBrandOptions(canSeeBrands && canEdit && authorization.data === null);

  async function act(run: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await run();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "Não foi possível concluir.");
      return;
    }
    toast.success(success);
    setNote("");
    await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
  }

  return (
    <SectionCard as="div" title="Autorização do cliente">
      <p className="text-sm text-muted-foreground">
        Um case só entra no site com a autorização do cliente registrada aqui. Retirar a autorização
        tira o case do ar na hora.
      </p>
      {authorization.data ? (
        <div className="space-y-3 text-sm">
          <p>
            Autorizado em {formatDate(authorization.data.authorizedAt)}. Registro:{" "}
            <em>{authorization.data.note}</em>
          </p>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act(() => withdrawCaseStudy({ data: { pageId } }), "Autorização retirada.")
              }
            >
              <ShieldOff aria-hidden="true" />
              Retirar autorização
            </Button>
          ) : null}
        </div>
      ) : canEdit && canSeeBrands ? (
        <div className="space-y-3">
          <BrandSelect
            id="case-brand"
            label="Marca do cliente"
            value={brandId}
            onValueChange={setBrandId}
            brands={brands.data}
            placeholder="Escolha a marca"
          />
          <TextAreaField
            id="case-note"
            label="Registro do consentimento"
            value={note}
            onValueChange={setNote}
            maxLength={1000}
            rows={3}
          />
          <FormError message={error} />
          <Button
            type="button"
            disabled={busy || brandId === "" || note.trim().length < 5}
            onClick={() =>
              void act(
                () => authorizeCaseStudy({ data: { pageId, brandId, consentNote: note } }),
                "Case autorizado.",
              )
            }
          >
            <ShieldCheck aria-hidden="true" />
            Registrar autorização
          </Button>
        </div>
      ) : (
        <p className="text-sm">Este case ainda não tem autorização.</p>
      )}
    </SectionCard>
  );
}
