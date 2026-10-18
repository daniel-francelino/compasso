import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type ListSearch, listSearchSchema } from "@/lib/shared/list-search";
import { type ListSort, SortDirection } from "@/lib/shared/list-sort";
import { useDebouncedValue } from "./use-debounced-value";

export const useListState = <S extends string>(initialStatus: S) => {
  const raw = useSearch({ strict: false });
  const navigate = useNavigate();
  const search: ListSearch = listSearchSchema.parse(raw);

  const status = (search.status ?? initialStatus) as S;
  const page = search.page ?? 1;
  const sort: ListSort =
    search.sort === undefined ? null : { key: search.sort, dir: search.dir ?? SortDirection.Asc };

  const [text, setText] = useState(search.q ?? "");
  const debouncedSearch = useDebouncedValue(text.trim(), 300);

  const update = (patch: Partial<ListSearch>) =>
    navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({ ...previous, ...patch })) as never,
      replace: true,
    });

  useEffect(() => {
    if (debouncedSearch === (search.q ?? "")) return;
    void update({ q: debouncedSearch === "" ? undefined : debouncedSearch, page: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the debounced text drives the URL
  }, [debouncedSearch]);

  return {
    status,
    search: text,
    page,
    sort,
    debouncedSearch: search.q ?? "",
    setPage: (value: number) => update({ page: value === 1 ? undefined : value }),
    setStatus: (value: S) =>
      update({ status: value === initialStatus ? undefined : value, page: undefined }),
    setSearch: setText,
    filters: {
      scope: search.scope,
      brand: search.brand,
      kind: search.kind,
      folder: search.folder,
      order: search.order,
      owner: search.owner,
      tag: search.tag,
      client: search.client,
      platform: search.platform,
      editorial: search.editorial,
      channel: search.channel,
      publication: search.publication,
      view: search.view,
    },
    setFilter: (
      key:
        | "owner"
        | "tag"
        | "client"
        | "platform"
        | "scope"
        | "brand"
        | "kind"
        | "folder"
        | "order"
        | "editorial"
        | "channel"
        | "publication"
        | "view",
      value: string | undefined,
    ) => update({ [key]: value === "" ? undefined : value, page: undefined }),
    toggleSort: (key: string) => {
      if (sort?.key !== key) return update({ sort: key, dir: SortDirection.Asc, page: undefined });
      if (sort.dir === SortDirection.Asc) {
        return update({ sort: key, dir: SortDirection.Desc, page: undefined });
      }
      return update({ sort: undefined, dir: undefined, page: undefined });
    },
  };
};
