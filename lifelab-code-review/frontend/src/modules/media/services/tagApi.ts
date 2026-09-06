import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
} from "../../../lib/api";

export interface Tag {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagNameInput {
  name: string;
}

export interface TagDeleteImpact {
  tagId: number;
  libraryVideoCountToDetach: number;
  libraryVideosPreserved: boolean;
}

export function getTags() {
  return apiGet<Tag[]>("/api/tags");
}

export function createTag(input: TagNameInput) {
  return apiPost<Tag, TagNameInput>(
    "/api/tags",
    input,
  );
}

export function renameTag(
  tagId: number,
  input: TagNameInput,
) {
  return apiPatch<Tag, TagNameInput>(
    `/api/tags/${tagId}`,
    input,
  );
}

export function getTagDeleteImpact(
  tagId: number,
) {
  return apiGet<TagDeleteImpact>(
    `/api/tags/${tagId}/delete-impact`,
  );
}

export function deleteTag(tagId: number) {
  return apiDelete(`/api/tags/${tagId}`);
}

export function getVideoTags(
  libraryVideoId: number,
) {
  return apiGet<Tag[]>(
    `/api/library/videos/${libraryVideoId}/tags`,
  );
}

export function attachTagToVideo(
  libraryVideoId: number,
  tagId: number,
) {
  return apiPut<void>(
    `/api/library/videos/${libraryVideoId}/tags/${tagId}`,
  );
}

export function detachTagFromVideo(
  libraryVideoId: number,
  tagId: number,
) {
  return apiDelete(
    `/api/library/videos/${libraryVideoId}/tags/${tagId}`,
  );
}