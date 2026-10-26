import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plug } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { completeInstagramConnection } from "@/lib/marketing/channels/connection.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { AppRoute } from "@/lib/shared/routes";

const DENIED = "O Instagram não autorizou a conexão. Volte ao canal e tente de novo.";

export function InstagramCallbackPage({
  code,
  state,
  error,
}: {
  code: string | undefined;
  state: string | undefined;
  error: string | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const started = useRef(false);
  const [message, setMessage] = useState<string | null>(
    error !== undefined || code === undefined || state === undefined ? DENIED : null,
  );

  useEffect(() => {
    if (started.current || message !== null || code === undefined || state === undefined) return;
    started.current = true;
    void completeInstagramConnection({ data: { code, state } }).then(async (result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: QueryKey.Channels.all(result.brandId) });
      toast.success("Instagram conectado.");
      await navigate({
        to: "/admin/marketing/brands/$brandId/channels",
        params: { brandId: result.brandId },
      });
    });
  }, [code, state, message, navigate, queryClient]);

  if (message === null) return <PageSkeleton />;
  return (
    <EmptyState
      icon={Plug}
      title="Não foi possível conectar"
      description={message}
      action={
        <Button variant="outline" onClick={() => void navigate({ to: AppRoute.Brands })}>
          Voltar para as marcas
        </Button>
      }
    />
  );
}
