import type { Response } from "express";

export type ApiErrorBody = {
  code: string;
  params?: Record<string, string | number | boolean | null>;
  /** Legacy string — clients must prefer `code`. */
  error: string;
};

const LEGACY_TEXT: Record<string, string> = {
  "error.unauthorized": "Please sign in to continue.",
  "error.forbidden": "You do not have permission to do that.",
  "error.notFound": "Not found",
  "error.conflict": "That action already happened.",
  "error.rateLimited": "Too many attempts. Please wait.",
  "error.server": "Server error. Please try again.",
  "error.invalidToken": "Invalid token",
  "error.muted": "You are muted",
  "error.notThreadMember": "Not a member of this thread",
  "error.giftNotAvailable": "Gift not available",
  "error.insufficient": "Insufficient balance",
  "wallet.insufficientBalance": "Not enough coins",
  "gift.insufficientCoins": "Not enough coins to send this gift.",
  "gift.unknown": "Unknown gift",
  "gift.catalog_changed": "Gift catalog or price updated. Refresh and try again.",
  "error.seatOccupied": "Seat occupied",
  "error.hostRequired": "Host permission required",
  "error.streamNotLive": "Stream is not live",
  "error.partyRoomEnded": "This room has ended",
  "error.impersonation": "Invalid identity",
  "moderation.banned": "This account is banned",
  "common.unknownError": "Something went wrong. Please try again.",
};

export function apiError(
  res: Response,
  status: number,
  code: string,
  params?: Record<string, string | number | boolean | null>,
): void {
  const body: ApiErrorBody = {
    code,
    error: LEGACY_TEXT[code] || code,
  };
  if (params && Object.keys(params).length) body.params = params;
  res.status(status).json(body);
}
