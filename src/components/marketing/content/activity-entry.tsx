import { motion } from "motion/react";
import type { ReactNode } from "react";
import { PersonAvatar, type PersonAvatarSize } from "@/components/shared/admin/person-avatar";

const entryMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2 },
};

export function ActivityEntry({
  name,
  avatarUrl,
  size = "md",
  children,
}: {
  name: string;
  avatarUrl: string | undefined;
  size?: PersonAvatarSize;
  children: ReactNode;
}) {
  return (
    <motion.li layout="position" className="flex gap-3" {...entryMotion}>
      <PersonAvatar name={name} url={avatarUrl} size={size} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </motion.li>
  );
}
