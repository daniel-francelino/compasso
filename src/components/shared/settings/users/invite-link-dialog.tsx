import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { Input } from "@/components/shared/ui/input";
import { formatDate } from "@/lib/shared/format";

export type InviteLink = { email: string; link: string; expiresAt: string; emailSent: boolean };

export function InviteLinkDialog({
  invite,
  onClose,
}: {
  invite: InviteLink | null;
  onClose: () => void;
}) {
  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie o link manualmente.");
    }
  }

  return (
    <Dialog open={invite !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-5 text-muted-foreground" aria-hidden="true" />
            Link de acesso
          </DialogTitle>
          <DialogDescription>
            Envie este link para {invite?.email ?? "a pessoa"}. Ela define a própria senha e entra.
          </DialogDescription>
        </DialogHeader>
        {invite ? (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor="invite-link" className="text-sm font-medium">
                Link
              </label>
              <InfoTip label="Sobre o link">
                O link só aparece agora. Se perdê-lo, use “Gerar novo link” na lista de convites: o
                anterior deixa de funcionar.
              </InfoTip>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="invite-link"
                readOnly
                value={invite.link}
                className="h-11 md:h-10"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" onClick={() => void copy(invite.link)}>
                <Copy aria-hidden="true" />
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Vale até {formatDate(invite.expiresAt)} e só pode ser usado uma vez.
              {invite.emailSent ? " Um e-mail com o mesmo link também foi enviado." : ""}
            </p>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            <Check aria-hidden="true" />
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
