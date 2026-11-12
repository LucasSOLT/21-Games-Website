import type { AllGameSlug } from "@/lib/games-config";
import type { GenericOverrideMeta } from "@/lib/game-storage";

/** Request passed from a studio tab to the admin page's confirm-then-publish flow. */
export interface GenericPublishRequest {
  gameSlug: AllGameSlug;
  gameTitle: string;
  payload: unknown;
  meta: GenericOverrideMeta;
  /** One-line preview shown in the confirmation modal. */
  preview: string;
  details: string[];
  playImmediately?: boolean;
}
