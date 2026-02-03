import { config } from './config.js';

interface StreamAccess {
  token: string;
  endpoint: string;
  expiresIn: number;
  fetchedAt: number;
}

export interface EventBatch {
  events: any[];
  cursor: string | null;
  hasMore: boolean;
}

export class StreamClient {
  private streamAccess: StreamAccess | null = null;

  private async getStreamToken(): Promise<StreamAccess> {
    const baseUrl = config.apiBaseUrl.replace('/api/v1', '');
    const tokenRes = await fetch(`${baseUrl}/internal/dashboard/stream-access`, {
      method: 'POST',
      headers: {
        'X-API-Key': config.apiKey,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!tokenRes.ok) {
      throw new Error(`Failed to get stream token: ${tokenRes.status}`);
    }
    
    const tokenData = await tokenRes.json() as any;
    
    if (!tokenData.streamAccess || !tokenData.streamAccess.token) {
      throw new Error(`Invalid stream access response`);
    }
    
    return {
      token: tokenData.streamAccess.token,
      endpoint: `${baseUrl}${tokenData.streamAccess.endpoint}`,
      expiresIn: tokenData.streamAccess.expiresIn,
      fetchedAt: Date.now()
    };
  }

  private async ensureToken(): Promise<StreamAccess> {
    if (!this.streamAccess || (Date.now() - this.streamAccess.fetchedAt) > 270000) {
      this.streamAccess = await this.getStreamToken();
    }
    return this.streamAccess;
  }

  async fetchBatch(cursor: string | null): Promise<EventBatch> {
    const access = await this.ensureToken();
    
    const url = new URL(access.endpoint);
    url.searchParams.set('limit', '5000');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: {
        'X-API-Key': config.apiKey,
        'X-Stream-Token': access.token
      }
    });

    if (res.status === 403 || res.status === 401) {
      this.streamAccess = await this.getStreamToken();
      return this.fetchBatch(cursor);
    }

    if (res.status === 400) {
      const errorText = await res.text();
      if (errorText.includes('CURSOR_EXPIRED') || errorText.includes('CURSOR_INVALID')) {
        return this.fetchBatch(null);
      }
      throw new Error(`HTTP 400: ${errorText}`);
    }

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 5000));
      return this.fetchBatch(cursor);
    }

    if (res.status >= 500) {
       console.error(`\nServer error ${res.status}, retrying in 5s...`);
       await new Promise(r => setTimeout(r, 5000));
       return this.fetchBatch(cursor);
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 200)}`);
    }

    let json: any;
    try {
      // Clone response to read text if json fails? No, can only read body once.
      // So read text first, then parse.
      const text = await res.text();
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error(`\nJSON parse error. Body snippet: ${text.substring(0, 100)}...`);
        throw e;
      }
    } catch (parseError: any) {
      console.error(`\nRetrying batch due to parse error...`);
      await new Promise(r => setTimeout(r, 1000));
      // Force token refresh on parse error, might be session issue
      this.streamAccess = await this.getStreamToken();
      return this.fetchBatch(cursor);
    }
    
    return {
      events: json.data || [],
      cursor: json.pagination?.nextCursor || null,
      hasMore: json.pagination?.hasMore || false
    };
  }

  async *streamEvents(startCursor: string | null = null): AsyncGenerator<{ events: any[], cursor: string | null }, void, unknown> {
    let cursor: string | null = startCursor;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.fetchBatch(cursor);
      
      if (batch.events.length > 0) {
        yield { events: batch.events, cursor: batch.cursor };
      }
      
      cursor = batch.cursor;
      hasMore = batch.hasMore;
    }
  }
}
