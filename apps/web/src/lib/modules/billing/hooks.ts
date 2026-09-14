"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { billingApi } from "./api";
import type { Entitlements } from "./api";
import type { PriceRegion } from "@/lib/pricing";

export function useEntitlementsQuery(options?: {
  enabled?: boolean;
  /** Poll interval in ms, or a function of the latest data (`false` stops). */
  refetchInterval?:
    | number
    | false
    | ((data: Entitlements | undefined) => number | false);
}) {
  const interval = options?.refetchInterval;
  return useQuery({
    queryKey: queryKeys.billing.me,
    queryFn: () => billingApi.me(),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
    refetchInterval:
      typeof interval === "function"
        ? (query) => interval(query.state.data)
        : interval,
  });
}

/** Live Pro price + running promotion for a region (public, cached). */
export function useProPricingQuery(region: PriceRegion, enabled = true) {
  return useQuery({
    queryKey: queryKeys.billing.pricing(region),
    queryFn: () => billingApi.pricing(region),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useValidateDiscountMutation() {
  return useMutation({ mutationFn: billingApi.validateDiscount });
}

export function useCreateCheckoutMutation() {
  return useMutation({
    mutationFn: (body: { discountCode?: string }) => billingApi.checkout(body),
  });
}

export function usePortalMutation() {
  return useMutation({ mutationFn: billingApi.portal });
}

export function useSyncBillingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: billingApi.sync,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.billing.me, data);
    },
  });
}

/** Call after anything that spends a plan allowance (quiz create, AI runs). */
export function useInvalidateEntitlements() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.billing.me });
}
