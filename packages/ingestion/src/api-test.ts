import { config } from './config.js';
import { ApiResponse, RateLimitInfo } from './types.js';

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
  }

  async fetchEvents(cursor: string | null = null, limit: number = 1000): Promise<{ response: ApiResponse; rateLimit: RateLimitInfo | null }> {
    return {
      response: { data: [], hasMore: false },
      rateLimit: null
    };
  }
}
