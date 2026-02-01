import { config } from './config.js';
import { ApiResponse, RateLimitInfo } from './types.js';

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private useQueryAuth: boolean;

  constructor(useQueryAuth: boolean = false) {
    this.baseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
    this.useQueryAuth = useQueryAuth;
  }

  async fetchEvents(cursor: string | null = null, limit: number = 1000): Promise<{ response: ApiResponse; rateLimit: RateLimitInfo | null }> {
    const url = new URL(`${this.baseUrl}/events`);
    url.searchParams.set('limit', limit.toString());
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }
    
    // Use query param auth OR header auth
    const headers: Record<string, string> = {};
    if (this.useQueryAuth) {
      url.searchParams.set('api_key', this.apiKey);
    } else {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(url.toString(), { headers });

    // Parse rate limit headers (present in both success and error responses)
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');

    let rateLimit: RateLimitInfo | null = null;
    if (rateLimitRemaining && rateLimitReset) {
      // Reset is in seconds from now, not a timestamp
      const resetSeconds = parseInt(rateLimitReset, 10);
      rateLimit = {
        remaining: parseInt(rateLimitRemaining, 10),
        resetAt: new Date(Date.now() + resetSeconds * 1000).toISOString(),
      };
    }

    // Handle rate limit errors
    if (response.status === 429) {
      const errorData = await response.json() as any;
      const retryAfter = errorData.rateLimit?.retryAfter || parseInt(rateLimitReset || '60', 10);
      throw new Error(`RATE_LIMIT_EXCEEDED:${retryAfter}`);
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    // Handle different response formats
    // Format 1: Array of events
    if (Array.isArray(data)) {
      return {
        response: {
          data,
          hasMore: data.length === limit,
          nextCursor: undefined,
        },
        rateLimit,
      };
    }
    
    // Format 2: Object with data array
    return {
      response: {
        data: data.data || [],
        hasMore: data.hasMore || data.pagination?.hasMore || false,
        nextCursor: data.nextCursor || data.pagination?.nextCursor || undefined,
      },
      rateLimit,
    };
  }

  async testConnection(): Promise<void> {
    try {
      await fetch(this.baseUrl, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });
      console.log('API connection test successful');
    } catch (error) {
      console.error('API connection test failed:', error);
      throw error;
    }
  }
}
