export type EntityType = "video" | "music" | "note" | "todo" | "journal" | "calendar";

export interface BaseEntity {
  id: string;
  type: EntityType;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface VideoItem extends BaseEntity {
  type: "video";
  sourceType: "local" | "embed";
  url: string;
  tags?: string[];
}

export interface NoteItem extends BaseEntity {
  type: "note";
  content: string;

  linkedEntityId?: string;
  linkedEntityType?: EntityType;
  timestamp?: number;
}