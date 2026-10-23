import type { ReactNode } from "react";
import { PersonAvatar } from "@/components/shared/admin/person-avatar";

export function ActivityEntry({
  name,
  avatarUrl,
  children,
}: {
  name: string;
  avatarUrl: string | undefined;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <PersonAvatar name={name} url={avatarUrl} size="md" className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </li>
  );
}
