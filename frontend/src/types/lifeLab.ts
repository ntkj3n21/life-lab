export type EntityType =
  | "video"
  | "music"
  | "note"
  | "todo"
  | "journal"
  | "calendar";

export interface BaseEntity {
  id: string;
  type: EntityType;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface MusicTrack
  extends BaseEntity {
  type: "music";

  artist?: string;
  url: string;
  tags?: string[];
}