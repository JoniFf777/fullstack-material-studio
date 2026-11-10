"use client";

import { useQuery } from "@tanstack/react-query";
import { getCategories, getTemplate, getTemplates } from "@/lib/api/endpoints";
import { CATALOG_STALE_TIME } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: CATALOG_STALE_TIME,
  });
}

export function useTemplates(category: string | null) {
  return useQuery({
    queryKey: queryKeys.templates(category),
    queryFn: ({ signal }) => getTemplates(category, signal),
    staleTime: CATALOG_STALE_TIME,
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.template(id),
    queryFn: ({ signal }) => getTemplate(id, signal),
    staleTime: CATALOG_STALE_TIME,
  });
}
