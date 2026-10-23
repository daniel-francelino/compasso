import { Activity, History, MessageSquare } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { CommentsPanel } from "@/components/marketing/content/comments-panel";
import { RevisionHistory } from "@/components/marketing/content/revision-history";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Badge } from "@/components/shared/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { useContentComments } from "@/hooks/marketing/use-content-comments";
import { useAvatarUrls } from "@/hooks/shared/use-avatar-urls";
import type { RequestRow } from "@/lib/marketing/content/types";
import { useAuth } from "@/lib/shared/auth/use-auth";

const ActivityTab = { Comments: "comments", History: "history" } as const;
type ActivityTab = (typeof ActivityTab)[keyof typeof ActivityTab];

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;

export function ActivitySection({ itemId, requests }: { itemId: string; requests: RequestRow[] }) {
  const auth = useAuth();
  const [tab, setTab] = useState<ActivityTab>(ActivityTab.Comments);
  const comments = useContentComments(itemId);
  const avatars = useAvatarUrls([
    auth.profile?.id,
    ...(comments.data ?? []).map((comment) => comment.authorId),
    ...requests.flatMap((request) => [request.requestedById, request.decidedById]),
  ]);
  const count = (comments.data ?? []).filter((comment) => !comment.deleted).length;

  return (
    <MotionConfig reducedMotion="user">
      <SectionCard title="Atividade" icon={Activity}>
        <Tabs
          value={tab}
          onValueChange={(next) =>
            setTab(next === ActivityTab.History ? next : ActivityTab.Comments)
          }
        >
          <TabsList>
            <TabsTrigger value={ActivityTab.Comments}>
              <MessageSquare aria-hidden="true" />
              Comentários
              {count > 0 ? (
                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[0.6875rem]">
                  {count}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value={ActivityTab.History}>
              <History aria-hidden="true" />
              Histórico
            </TabsTrigger>
          </TabsList>
          <TabsContent value={ActivityTab.Comments} className="mt-4">
            <motion.div {...fade}>
              <CommentsPanel
                itemId={itemId}
                avatars={avatars}
                ownAvatarUrl={avatars[auth.profile?.id ?? ""]}
              />
            </motion.div>
          </TabsContent>
          <TabsContent value={ActivityTab.History} className="mt-4">
            <motion.div {...fade}>
              <RevisionHistory requests={requests} avatars={avatars} />
            </motion.div>
          </TabsContent>
        </Tabs>
      </SectionCard>
    </MotionConfig>
  );
}
