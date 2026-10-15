import type { AxiosInstance } from "axios";
import type { Category, UpsertCategory } from "@buzrr/contract";
import { getAuthApiClient } from "@/lib/api/client";

export type CategoryWithCount = Category & {
  createdAt: string;
  questionCount: number;
};

export async function listCategories(client: AxiosInstance) {
  const { data } = await client.get<CategoryWithCount[]>("/categories");
  return data;
}

export async function createCategory(
  client: AxiosInstance,
  body: UpsertCategory,
) {
  const { data } = await client.post<Category>("/categories", body);
  return data;
}

export async function updateCategory(
  client: AxiosInstance,
  id: string,
  body: UpsertCategory,
) {
  const { data } = await client.patch<Category>(`/categories/${id}`, body);
  return data;
}

export async function deleteCategory(client: AxiosInstance, id: string) {
  await client.delete(`/categories/${id}`);
}

export const categoriesApi = {
  list: () => listCategories(getAuthApiClient()),
  create: (body: UpsertCategory) => createCategory(getAuthApiClient(), body),
  update: (id: string, body: UpsertCategory) =>
    updateCategory(getAuthApiClient(), id, body),
  remove: (id: string) => deleteCategory(getAuthApiClient(), id),
};
