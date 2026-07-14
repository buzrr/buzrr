import type { AxiosInstance } from "axios";
import type { Role } from "@/types/db";
import { getAuthApiClient } from "@/lib/api/client";

export type AdminUserItem = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
};

export type AdminUsersPage = {
  items: AdminUserItem[];
  nextCursor: string | null;
};

export async function listAdminUsers(
  client: AxiosInstance,
  params: { search?: string; cursor?: string },
) {
  const { data } = await client.get<AdminUsersPage>("/superadmin/users", {
    params,
  });
  return data;
}

export async function setUserRole(
  client: AxiosInstance,
  userId: string,
  role: "admin" | "user",
) {
  await client.patch(`/superadmin/users/${userId}/role`, { role });
}

export const adminUsersApi = {
  list: (params: { search?: string; cursor?: string }) =>
    listAdminUsers(getAuthApiClient(), params),
  setRole: (userId: string, role: "admin" | "user") =>
    setUserRole(getAuthApiClient(), userId, role),
};
