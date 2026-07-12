const PHOTOS_API_BASE = "https://photoslibrary.googleapis.com/v1";

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

export class PhotosClient {
  constructor(private accessToken: string) {}

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json"
    };
  }

  async listMediaItems(
    pageToken?: string,
    pageSize = 100
  ): Promise<ListMediaItemsResult> {
    const res = await fetch(
      `${PHOTOS_API_BASE}/mediaItems?pageSize=${pageSize}${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
      }`,
      { headers: this.headers() }
    );

    if (!res.ok) {
      throw new Error(`Photos API list failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      mediaItems?: RawMediaItem[];
      nextPageToken?: string;
    };

    return {
      items: (data.mediaItems ?? []).map(normalize),
      nextPageToken: data.nextPageToken ?? undefined
    };
  }

  async batchDelete(ids: string[]): Promise<void> {
    const res = await fetch(`${PHOTOS_API_BASE}/mediaItems:batchDelete`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ mediaItemIds: ids })
    });

    if (!res.ok) {
      throw new Error(`Photos API batchDelete failed: ${res.status}`);
    }
  }
}
