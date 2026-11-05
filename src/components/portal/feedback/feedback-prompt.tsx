import { useState } from "react";
import { FeedbackBanner } from "@/components/portal/feedback/feedback-banner";
import { FeedbackPromptDialog } from "@/components/portal/feedback/feedback-prompt-dialog";
import { useFeedbackPrompt } from "@/hooks/portal/use-feedback-prompt";
import { snoozePortalFeedback } from "@/lib/portal/feedback/feedback.functions";
import { FeedbackPromptState } from "@/lib/shared/feedback/types";

export function FeedbackPrompt({ brandId }: { brandId: string }) {
  const { prompt, refresh } = useFeedbackPrompt(brandId);
  const [closed, setClosed] = useState(false);
  const [openedByBanner, setOpenedByBanner] = useState(false);

  if (prompt === null || prompt.periodMonth === null || prompt.state === FeedbackPromptState.None) {
    return null;
  }
  const period = prompt.periodMonth;
  const isBanner = prompt.state === FeedbackPromptState.Banner;
  const open = isBanner ? openedByBanner : !closed;

  async function later() {
    setClosed(true);
    setOpenedByBanner(false);
    if (isBanner) return;
    await snoozePortalFeedback({ data: { brandId, periodMonth: period } });
    await refresh();
  }

  function finished() {
    setClosed(true);
    setOpenedByBanner(false);
    void refresh();
  }

  return (
    <>
      {isBanner ? <FeedbackBanner period={period} onOpen={() => setOpenedByBanner(true)} /> : null}
      <FeedbackPromptDialog
        brandId={brandId}
        period={period}
        open={open}
        onLater={later}
        onFinished={finished}
      />
    </>
  );
}
