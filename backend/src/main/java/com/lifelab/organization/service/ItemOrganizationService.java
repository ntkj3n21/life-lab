package com.lifelab.organization.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.note.domain.Note;
import com.lifelab.note.domain.NoteTag;
import com.lifelab.note.dto.NoteResponse;
import com.lifelab.note.exception.NoteNotFoundException;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.note.repository.NoteTagRepository;
import com.lifelab.organization.category.domain.Category;
import com.lifelab.organization.category.dto.CategoryResponse;
import com.lifelab.organization.category.service.CategoryService;
import com.lifelab.organization.dto.ItemOrganizationResponse;
import com.lifelab.organization.dto.UpdateItemOrganizationRequest;
import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskTag;
import com.lifelab.task.dto.TaskResponse;
import com.lifelab.task.exception.TaskNotFoundException;
import com.lifelab.task.repository.TaskRepository;
import com.lifelab.task.repository.TaskTagRepository;
import com.lifelab.video.domain.Tag;
import com.lifelab.video.dto.TagResponse;
import com.lifelab.video.exception.TagNotFoundException;
import com.lifelab.video.repository.TagRepository;

@Service
public class ItemOrganizationService {

    private final NoteRepository noteRepository;
    private final TaskRepository taskRepository;
    private final NoteTagRepository noteTagRepository;
    private final TaskTagRepository taskTagRepository;
    private final TagRepository tagRepository;
    private final CategoryService categoryService;
    private final Clock clock;

    public ItemOrganizationService(
            NoteRepository noteRepository,
            TaskRepository taskRepository,
            NoteTagRepository noteTagRepository,
            TaskTagRepository taskTagRepository,
            TagRepository tagRepository,
            CategoryService categoryService,
            Clock clock) {
        this.noteRepository = noteRepository;
        this.taskRepository = taskRepository;
        this.noteTagRepository = noteTagRepository;
        this.taskTagRepository = taskTagRepository;
        this.tagRepository = tagRepository;
        this.categoryService = categoryService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ItemOrganizationResponse getNoteOrganization(Long accountId, Long noteId) {
        Note note = findOwnedNote(accountId, noteId);
        return noteOrganizationResponse(note);
    }

    @Transactional
    public ItemOrganizationResponse updateNoteOrganization(
            Long accountId,
            Long noteId,
            UpdateItemOrganizationRequest request) {
        Note note = findOwnedNote(accountId, noteId);
        Category category = categoryService.findOwnedCategory(accountId, request.categoryId());
        List<Tag> tags = findOwnedTags(accountId, request.tagIds());
        OffsetDateTime now = OffsetDateTime.now(clock);

        note.changeCategory(category, now);
        noteRepository.saveAndFlush(note);

        noteTagRepository.deleteAllByNote_Id(noteId);
        noteTagRepository.flush();
        if (!tags.isEmpty()) {
            noteTagRepository.saveAllAndFlush(
                    tags.stream().map(tag -> NoteTag.create(note, tag)).toList());
        }

        return noteOrganizationResponse(note);
    }

    @Transactional(readOnly = true)
    public ItemOrganizationResponse getTaskOrganization(Long accountId, Long taskId) {
        Task task = findOwnedTask(accountId, taskId);
        return taskOrganizationResponse(task);
    }

    @Transactional
    public ItemOrganizationResponse updateTaskOrganization(
            Long accountId,
            Long taskId,
            UpdateItemOrganizationRequest request) {
        Task task = findOwnedTask(accountId, taskId);
        Category category = categoryService.findOwnedCategory(accountId, request.categoryId());
        List<Tag> tags = findOwnedTags(accountId, request.tagIds());
        OffsetDateTime now = OffsetDateTime.now(clock);

        task.changeCategory(category, now);
        taskRepository.saveAndFlush(task);

        taskTagRepository.deleteAllByTask_Id(taskId);
        taskTagRepository.flush();
        if (!tags.isEmpty()) {
            taskTagRepository.saveAllAndFlush(
                    tags.stream().map(tag -> TaskTag.create(task, tag)).toList());
        }

        return taskOrganizationResponse(task);
    }

    public void validateOwnedOrganizationFilters(
            Long accountId,
            Long categoryId,
            List<Long> tagIds) {
        categoryService.findOwnedCategory(accountId, categoryId);
        findOwnedTags(accountId, tagIds == null ? List.of() : tagIds);
    }

    public NoteResponse toNoteResponse(Note note) {
        return NoteResponse.from(note, noteTagsByItemId(List.of(note.getId()))
                .getOrDefault(note.getId(), List.of()));
    }

    public Page<NoteResponse> toNoteResponses(Page<Note> notes) {
        Map<Long, List<TagResponse>> tagsByNoteId = noteTagsByItemId(
                notes.getContent().stream().map(Note::getId).toList());
        return notes.map(note -> NoteResponse.from(
                note,
                tagsByNoteId.getOrDefault(note.getId(), List.of())));
    }

    public List<NoteResponse> toNoteResponses(List<Note> notes) {
        Map<Long, List<TagResponse>> tagsByNoteId = noteTagsByItemId(
                notes.stream().map(Note::getId).toList());
        return notes.stream()
                .map(note -> NoteResponse.from(
                        note,
                        tagsByNoteId.getOrDefault(note.getId(), List.of())))
                .toList();
    }

    public TaskResponse toTaskResponse(Task task) {
        return TaskResponse.from(task, taskTagsByItemId(List.of(task.getId()))
                .getOrDefault(task.getId(), List.of()));
    }

    public Page<TaskResponse> toTaskResponses(Page<Task> tasks) {
        Map<Long, List<TagResponse>> tagsByTaskId = taskTagsByItemId(
                tasks.getContent().stream().map(Task::getId).toList());
        return tasks.map(task -> TaskResponse.from(
                task,
                tagsByTaskId.getOrDefault(task.getId(), List.of())));
    }

    public List<TaskResponse> toTaskResponses(List<Task> tasks) {
        Map<Long, List<TagResponse>> tagsByTaskId = taskTagsByItemId(
                tasks.stream().map(Task::getId).toList());
        return tasks.stream()
                .map(task -> TaskResponse.from(
                        task,
                        tagsByTaskId.getOrDefault(task.getId(), List.of())))
                .toList();
    }

    private ItemOrganizationResponse noteOrganizationResponse(Note note) {
        return new ItemOrganizationResponse(
                CategoryResponse.from(note.getCategory()),
                noteTagsByItemId(List.of(note.getId())).getOrDefault(note.getId(), List.of()));
    }

    private ItemOrganizationResponse taskOrganizationResponse(Task task) {
        return new ItemOrganizationResponse(
                CategoryResponse.from(task.getCategory()),
                taskTagsByItemId(List.of(task.getId())).getOrDefault(task.getId(), List.of()));
    }

    private Map<Long, List<TagResponse>> noteTagsByItemId(Collection<Long> noteIds) {
        Map<Long, List<TagResponse>> tagsByNoteId = new HashMap<>();
        if (noteIds.isEmpty()) {
            return tagsByNoteId;
        }
        noteTagRepository.findAllWithTagByNoteIdIn(noteIds).forEach(noteTag ->
                tagsByNoteId.computeIfAbsent(noteTag.getNote().getId(), ignored -> new ArrayList<>())
                        .add(TagResponse.from(noteTag.getTag())));
        return tagsByNoteId;
    }

    private Map<Long, List<TagResponse>> taskTagsByItemId(Collection<Long> taskIds) {
        Map<Long, List<TagResponse>> tagsByTaskId = new HashMap<>();
        if (taskIds.isEmpty()) {
            return tagsByTaskId;
        }
        taskTagRepository.findAllWithTagByTaskIdIn(taskIds).forEach(taskTag ->
                tagsByTaskId.computeIfAbsent(taskTag.getTask().getId(), ignored -> new ArrayList<>())
                        .add(TagResponse.from(taskTag.getTag())));
        return tagsByTaskId;
    }

    private Note findOwnedNote(Long accountId, Long noteId) {
        return noteRepository.findByIdAndAccount_Id(noteId, accountId)
                .orElseThrow(NoteNotFoundException::new);
    }

    private Task findOwnedTask(Long accountId, Long taskId) {
        return taskRepository.findByIdAndAccount_Id(taskId, accountId)
                .orElseThrow(TaskNotFoundException::new);
    }

    private List<Tag> findOwnedTags(Long accountId, List<Long> requestedTagIds) {
        Set<Long> distinctIds = new LinkedHashSet<>(requestedTagIds);
        if (distinctIds.isEmpty()) {
            return List.of();
        }

        List<Tag> tags = new ArrayList<>(
                tagRepository.findAllByAccount_IdAndIdIn(accountId, distinctIds));
        if (tags.size() != distinctIds.size()) {
            throw new TagNotFoundException();
        }

        tags.sort((left, right) -> {
            int byName = left.getNormalizedName().compareTo(right.getNormalizedName());
            if (byName != 0) {
                return byName;
            }
            return left.getId().compareTo(right.getId());
        });
        return tags;
    }
}
