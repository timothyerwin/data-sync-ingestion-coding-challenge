import fetch from 'node-fetch';
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
    const url = new URL(`${this.baseUrl}/events`);
    url.searchParams.set('limit', limit.toString());
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as ApiResponse;

    // Parse rate limit headers
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');

    let rateLimit: RateLimitInfo | null = null;
    if (rateLimitRemaining && rateLimitReset) {
      rateLimit = {
        remaining: parseInt(rateLimitRemaining, 10),
        resetAt: new Date(parseInt(rateLimitReset, 10) * 1000).toISOString(),
      };
    }

    return { response: data, rateLimit };
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
