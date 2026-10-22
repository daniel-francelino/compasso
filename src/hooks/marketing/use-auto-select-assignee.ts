import { useEffect, useRef } from "react";

export const useAutoSelectAssignee = ({
  enabled,
  brandId,
  assignees,
  selected,
  onSelect,
}: {
  enabled: boolean;
  brandId: string;
  assignees: { id: string; name: string }[];
  selected: string | null;
  onSelect: (assigneeId: string) => void;
}) => {
  const handledBrand = useRef<string | null>(null);
  const only = assignees.length === 1 ? assignees[0] : undefined;

  useEffect(() => {
    if (!enabled || brandId === "" || only === undefined) return;
    if (handledBrand.current === brandId) return;
    handledBrand.current = brandId;
    if (selected === null) onSelect(only.id);
  }, [enabled, brandId, only, selected, onSelect]);
};
