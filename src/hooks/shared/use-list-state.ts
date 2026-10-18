import { useState } from "react";
import type { ListSort } from "@/lib/shared/list-sort";
import { useDebouncedValue } from "./use-debounced-value";
import { SortDirection } from "@/lib/shared/list-sort";

export const useListState = <S extends string>(initialStatus: S) => {
  const [status, setStatusValue] = useState<S>(initialStatus);
  const [search, setSearchValue] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ListSort>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  return {
    status,
    search,
    page,
    sort,
    debouncedSearch,
    setPage,
    toggleSort: (key: string) => {
      setSort((current) =>
        current?.key !== key
          ? { key, dir: SortDirection.Asc }
          : current.dir === SortDirection.Asc
            ? { key, dir: SortDirection.Desc }
            : null,
      );
      setPage(1);
    },
    setStatus: (value: S) => {
      setStatusValue(value);
      setPage(1);
    },
    setSearch: (value: string) => {
      setSearchValue(value);
      setPage(1);
    },
  };
};
