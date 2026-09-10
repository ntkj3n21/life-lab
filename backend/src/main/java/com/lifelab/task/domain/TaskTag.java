package com.lifelab.task.domain;

import com.lifelab.video.domain.Tag;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

@Entity
@Table(name = "task_tags")
public class TaskTag {

    @EmbeddedId
    private TaskTagId id;

    @MapsId("taskId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @MapsId("tagId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false)
    private Tag tag;

    protected TaskTag() {
    }

    public static TaskTag create(Task task, Tag tag) {
        if (task == null) {
            throw new NullPointerException("task must not be null");
        }
        if (tag == null) {
            throw new NullPointerException("tag must not be null");
        }
        TaskTag relation = new TaskTag();
        relation.id = new TaskTagId(task.getId(), tag.getId());
        relation.task = task;
        relation.tag = tag;
        return relation;
    }

    public TaskTagId getId() {
        return id;
    }

    public Task getTask() {
        return task;
    }

    public Tag getTag() {
        return tag;
    }
}
