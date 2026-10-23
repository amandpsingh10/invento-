import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { NotificationItem } from "@/types";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await apiClient.get<{ data: { items: NotificationItem[]; unreadCount: number } }>("/notifications")).data.data,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.put(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.put("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
