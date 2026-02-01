export interface Event {
  id: string;
  [key: string]: any;
}

export interface ApiResponse {
  data: Event[];
  hasMore: boolean;
  nextCursor?: string;
  cursor?: string;
}

export interface IngestionState {
  cursor: string | null;
  cursorCreatedAt: string | null;
  eventsIngested: number;
  rateLimitRemaining: number | null;
  rateLimitResetAt: string | null;
  lastUpdated: string;
  status: 'running' | 'complete' | 'error';
}

export interface RateLimitInfo {
  remaining: number;
  resetAt: string;
}
