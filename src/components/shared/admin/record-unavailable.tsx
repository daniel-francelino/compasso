import { Link, type LinkProps } from "@tanstack/react-router";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { Button } from "@/components/shared/ui/button";

export function RecordUnavailable({
  title,
  message,
  backTo,
  backLabel,
}: {
  title: string;
  message: string;
  backTo: NonNullable<LinkProps["to"]>;
  backLabel: string;
}) {
  return (
    <EmptyState
      icon={FileQuestion}
      title={title}
      description={message}
      action={
        <Button asChild>
          <Link to={backTo}>
            <ArrowLeft aria-hidden="true" />
            {backLabel}
          </Link>
        </Button>
      }
    />
  );
}
