package com.lifelab.task.domain;

import java.io.Serializable;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class TaskTagId implements Serializable {

    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "tag_id")
    private Long tagId;

    protected TaskTagId() {
    }

    TaskTagId(Long taskId, Long tagId) {
        this.taskId = taskId;
        this.tagId = tagId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof TaskTagId that)) {
            return false;
        }
        return Objects.equals(taskId, that.taskId)
                && Objects.equals(tagId, that.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(taskId, tagId);
    }
}
