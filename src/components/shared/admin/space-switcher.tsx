import { type AdminSpace, adminSpaces } from "@/components/shared/admin/nav-config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/ui/select";

const isAdminSpace = (value: string): value is AdminSpace =>
  adminSpaces.some((space) => space.key === value);

export function SpaceSwitcher({
  space,
  onChange,
}: {
  space: AdminSpace;
  onChange: (space: AdminSpace) => void;
}) {
  return (
    <Select
      value={space}
      onValueChange={(value) => {
        if (isAdminSpace(value)) onChange(value);
      }}
    >
      <SelectTrigger aria-label="Trocar de espaço" className="h-11 bg-surface md:h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {adminSpaces.map((item) => (
          <SelectItem key={item.key} value={item.key}>
            {item.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
