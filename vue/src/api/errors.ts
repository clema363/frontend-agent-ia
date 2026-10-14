import { ApiError } from "./client";
export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;
  if (cause instanceof Error) return new ApiError(0, cause.message);
  return new ApiError(0, "The request failed. Please try again.");
}
