import { ArrowDownUp, History, MessageSquare } from "lucide-react";
import { useState } from "react";
import { CommentsPanel } from "@/components/marketing/content/comments-panel";
import { RevisionHistory } from "@/components/marketing/content/revision-history";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { useContentComments } from "@/hooks/marketing/use-content-comments";
import { useAvatarUrls } from "@/hooks/shared/use-avatar-urls";
import type { RequestRow } from "@/lib/marketing/content/types";
import { useAuth } from "@/lib/shared/auth/use-auth";

const ActivityTab = { Comments: "comments", History: "history" } as const;
type ActivityTab = (typeof ActivityTab)[keyof typeof ActivityTab];

export function ActivitySection({ itemId, requests }: { itemId: string; requests: RequestRow[] }) {
  const auth = useAuth();
  const [tab, setTab] = useState<ActivityTab>(ActivityTab.Comments);
  const [newestFirst, setNewestFirst] = useState(true);
  const comments = useContentComments(itemId);
  const avatars = useAvatarUrls([
    auth.profile?.id,
    ...(comments.data ?? []).map((comment) => comment.authorId),
    ...requests.flatMap((request) => [request.requestedById, request.decidedById]),
  ]);
  const count = comments.data?.length ?? 0;

  return (
    <SectionCard title="Atividade" icon={MessageSquare}>
      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next === ActivityTab.History ? next : ActivityTab.Comments)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value={ActivityTab.Comments}>
              <MessageSquare aria-hidden="true" />
              Comentários{count > 0 ? ` (${count})` : ""}
            </TabsTrigger>
            <TabsTrigger value={ActivityTab.History}>
              <History aria-hidden="true" />
              Histórico
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={newestFirst}
            onClick={() => setNewestFirst((current) => !current)}
          >
            <ArrowDownUp aria-hidden="true" />
            {newestFirst ? "Mais recentes primeiro" : "Mais antigas primeiro"}
          </Button>
        </div>
        <TabsContent value={ActivityTab.Comments} className="mt-4">
          <CommentsPanel
            itemId={itemId}
            newestFirst={newestFirst}
            avatars={avatars}
            ownAvatarUrl={avatars[auth.profile?.id ?? ""]}
          />
        </TabsContent>
        <TabsContent value={ActivityTab.History} className="mt-4">
          <RevisionHistory requests={requests} newestFirst={newestFirst} avatars={avatars} />
        </TabsContent>
      </Tabs>
    </SectionCard>
  );
}
