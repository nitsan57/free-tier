import type { PhotosMediaItem } from "@/lib/google/photos";

export interface PhotoCardProps {
  item: PhotosMediaItem;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function PhotoCard({ item, selected, onToggle }: PhotoCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      aria-pressed={selected}
      className={`relative overflow-hidden rounded-md border ${
        selected ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-200"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.baseUrl}
        alt={item.filename}
        className="h-40 w-full object-cover"
      />
      <span className="block truncate px-2 py-1 text-xs text-gray-600">
        {item.filename}
      </span>
    </button>
  );
}
