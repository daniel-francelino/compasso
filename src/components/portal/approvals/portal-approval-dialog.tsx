import { PortalApprovalPage } from "@/components/portal/approvals/portal-approval-page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/shared/ui/dialog";

export function PortalApprovalDialog({
  brandId,
  requestId,
  onClose,
}: {
  brandId: string;
  requestId: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="left-0 top-0 block h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none p-0 sm:rounded-none sm:p-0">
        <DialogTitle className="sr-only">Detalhes do conteúdo</DialogTitle>
        <DialogDescription className="sr-only">
          Veja o conteúdo completo, os comentários e registre a sua decisão.
        </DialogDescription>
        <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-12 sm:px-6">
          <PortalApprovalPage brandId={brandId} requestId={requestId} embedded />
        </div>
      </DialogContent>
    </Dialog>
  );
}
