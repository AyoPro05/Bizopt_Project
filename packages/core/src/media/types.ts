export type MediaEditOperation = "trim" | "crop" | "reorder" | "rotate" | "filter";

export type MediaEditParams = {
  startMs?: number;
  endMs?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  order?: string[];
};

export type AudioLayerSnapshot = {
  id: string;
  audioAssetId: string;
  startMs: number;
  volume: number;
  sortOrder: number;
};

export type CarouselSlideSnapshot = {
  id: string;
  sortOrder: number;
  caption?: string;
  mediaAssetId?: string;
  mediaUrl?: string;
};
