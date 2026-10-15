import type { AxiosInstance } from "axios";
import type { Category } from "@buzrr/contract";
import { getAuthApiClient } from "@/lib/api/client";

export type CategoryWithCount = Category & {
  createdAt: string;
  questionCount: number;
};

export async function listCategories(client: AxiosInstance) {
  const { data } = await client.get<CategoryWithCount[]>("/categories");
  return data;
}

export const categoriesApi = {
  list: () => listCategories(getAuthApiClient()),
};
