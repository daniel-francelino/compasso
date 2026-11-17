import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, RefreshCw } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { VideoWorkspace } from "@/components/shared/video/video-workspace";
import { Button } from "@/components/shared/ui/button";
import { ErrorCode } from "@/lib/shared/auth/errors";
import { QueryKey } from "@/lib/shared/query-keys";
import { ResultError, unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";
import { getVideoProject } from "@/lib/shared/video/video.functions";

const isNotFound = (error: Error) =>
  error instanceof ResultError &&
  (error.code === ErrorCode.NotFound || error.code === ErrorCode.Denied);

export function VideoEditorPage({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [generation, setGeneration] = useState(0);
  const query = useQuery({
    queryKey: QueryKey.Video.detail(projectId),
    queryFn: async () => unwrapResult(await getVideoProject({ data: { id: projectId } })).project,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  const reload = async () => {
    await queryClient.resetQueries({ queryKey: QueryKey.Video.detail(projectId) });
    setGeneration((value) => value + 1);
  };

  if (query.isPending) return <PageSkeleton />;
  if (query.isError && !isNotFound(query.error)) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Não foi possível abrir o vídeo"
        description={query.error.message}
        action={
          <Button type="button" onClick={() => void query.refetch()}>
            <RefreshCw aria-hidden="true" />
            Tentar de novo
          </Button>
        }
      />
    );
  }
  if (query.isError) {
    return (
      <RecordUnavailable
        title="Vídeo não encontrado"
        message="Ele não existe ou você não tem acesso à marca dele."
        backTo={AppRoute.Videos}
        backLabel="Voltar para vídeos"
      />
    );
  }
  return <VideoWorkspace key={generation} project={query.data} onReload={() => void reload()} />;
}
