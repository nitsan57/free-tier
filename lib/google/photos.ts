const PHOTOS_API_BASE = "https://photoslibrary.googleapis.com/v1";

const BATCH_DELETE_LIMIT = 50;
const DEFAULT_PAGE_SIZE = 100;

export interface PhotosMediaItem {
  id: string;
  filename: string;
  mimeType: string;
  baseUrl: string;
  productUrl: string;
  mediaMetadata: {
    creationTime?: string;
    width?: string;
    height?: string;
    photo?: { cameraMake?: string; cameraModel?: string; category?: string[] };
  };
}

export interface ListMediaItemsResult {
  items: PhotosMediaItem[];
  nextPageToken?: string;
}

interface RawMediaItem {
  id?: string;
  filename?: string;
  mimeType?: string;
  baseUrl?: string;
  productUrl?: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
    photo?: { cameraMake?: string; cameraModel?: string; category?: string[] };
  };
}

export class PhotosApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = "PhotosApiError";
  }
}

function normalize(raw: RawMediaItem): PhotosMediaItem {
  return {
    id: raw.id ?? "",
    filename: raw.filename ?? "",
    mimeType: raw.mimeType ?? "",
    baseUrl: raw.baseUrl ?? "",
    productUrl: raw.productUrl ?? "",
    mediaMetadata: {
      creationTime: raw.mediaMetadata?.creationTime ?? undefined,
      width: raw.mediaMetadata?.width ?? undefined,
      height: raw.mediaMetadata?.height ?? undefined,
      photo: raw.mediaMetadata?.photo
        ? {
            cameraMake: raw.mediaMetadata.photo.cameraMake ?? undefined,
            cameraModel: raw.mediaMetadata.photo.cameraModel ?? undefined,
            category: raw.mediaMetadata.photo.category ?? []
          }
        : undefined
    }
  };
}

/**
 * Returns a valid Google access token. Implementations may refresh the token
 * on demand. `forceRefresh` asks the provider to obtain a fresh token even if
 * a cached one appears valid (used after a 401).
 */
export type TokenProvider = (forceRefresh?: boolean) => Promise<string>;

function toTokenProvider(tokenOrProvider: string | TokenProvider): TokenProvider {
  if (typeof tokenOrProvider === "function") return tokenOrProvider;
  const staticToken = tokenOrProvider;
  return async () => staticToken;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export class PhotosClient {
  private getToken: TokenProvider;

  constructor(tokenOrProvider: string | TokenProvider) {
    this.getToken = toTokenProvider(tokenOrProvider);
  }

  private async headers(): Promise<HeadersInit> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  private async request(
    path: string,
    init: RequestInit
  ): Promise<Response> {
    const res = await fetch(`${PHOTOS_API_BASE}${path}`, {
      ...init,
      headers: { ...(await this.headers()), ...(init.headers ?? {}) }
    });

    if (res.status === 401) {
      const token = await this.getToken(true);
      const retry = await fetch(`${PHOTOS_API_BASE}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      return retry;
    }

    return res;
  }

  private async assertOk(res: Response, action: string): Promise<void> {
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PhotosApiError(
        `Photos API ${action} failed: ${res.status}`,
        res.status,
        body
      );
    }
  }

  /**
   * Fetch a single page of media items. Pass `pageToken` from a previous
   * result to fetch the next page.
   */
  async listMediaItems(
    pageToken?: string,
    pageSize: number = DEFAULT_PAGE_SIZE
  ): Promise<ListMediaItemsResult> {
    const url = new URL(`${PHOTOS_API_BASE}/mediaItems`);
    url.searchParams.set("pageSize", String(pageSize));
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const res = await this.request(url.toString(), { method: "GET" });
    await this.assertOk(res, "list");

    const data = (await res.json()) as {
      mediaItems?: RawMediaItem[];
      nextPageToken?: string;
    };

    return {
      items: (data.mediaItems ?? []).map(normalize),
      nextPageToken: data.nextPageToken ?? undefined
    };
  }

  /**
   * Asynchronously iterate over every media item, following pagination until
   * exhausted (or `maxItems` is reached).
   */
  async *iterateMediaItems(
    pageSize: number = DEFAULT_PAGE_SIZE,
    maxItems?: number
  ): AsyncGenerator<PhotosMediaItem> {
    let pageToken: string | undefined;
    let fetched = 0;

    do {
      const { items, nextPageToken } = await this.listMediaItems(
        pageToken,
        pageSize
      );

      for (const item of items) {
        yield item;
        fetched += 1;
        if (maxItems !== undefined && fetched >= maxItems) return;
      }

      pageToken = nextPageToken;
    } while (pageToken);
  }

  /**
   * Convenience method to collect every media item into an array.
   */
  async getAllMediaItems(
    pageSize: number = DEFAULT_PAGE_SIZE,
    maxItems?: number
  ): Promise<PhotosMediaItem[]> {
    const all: PhotosMediaItem[] = [];
    for await (const item of this.iterateMediaItems(pageSize, maxItems)) {
      all.push(item);
    }
    return all;
  }

  /**
   * Batch-delete media items. The Photos API accepts at most 50 ids per
   * request, so larger arrays are split into chunks and deleted sequentially.
   * Throws a PhotosApiError if any chunk fails.
   */
  async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    for (const batch of chunk(ids, BATCH_DELETE_LIMIT)) {
      const res = await this.request(
        `${PHOTOS_API_BASE}/mediaItems:batchDelete`,
        {
          method: "POST",
          body: JSON.stringify({ mediaItemIds: batch })
        }
      );
      await this.assertOk(res, "batchDelete");
    }
  }
}
