import { CircleAlert, TriangleAlert } from "lucide-react";
import type { Problem } from "@/lib/shared/content/resolve";
import { ProblemSeverity } from "@/lib/shared/enums";

export function ProblemList({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) return null;
  const ordered = [...problems].sort((a, b) => a.severity.localeCompare(b.severity));
  return (
    <ul className="space-y-2" aria-label="Itens para corrigir">
      {ordered.map((problem, index) => {
        const isError = problem.severity === ProblemSeverity.Error;
        const Icon = isError ? CircleAlert : TriangleAlert;
        return (
          <li key={`${problem.code}-${index}`} className="flex items-start gap-2 text-sm">
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${isError ? "text-danger" : "text-warning"}`}
              aria-hidden="true"
            />
            <span>
              <span className="font-medium">{isError ? "Corrigir: " : "Atenção: "}</span>
              {problem.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
