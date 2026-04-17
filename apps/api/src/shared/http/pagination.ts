import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type PaginationEnvelope = {
  page: number;
  pageSize: number;
  total: number;
};

export function normalizePagination(query: unknown): PaginationQuery {
  return paginationQuerySchema.parse(query);
}
