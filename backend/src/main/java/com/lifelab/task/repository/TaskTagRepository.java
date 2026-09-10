package com.lifelab.task.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lifelab.task.domain.TaskTag;
import com.lifelab.task.domain.TaskTagId;

public interface TaskTagRepository extends JpaRepository<TaskTag, TaskTagId> {

    long countByTag_Id(Long tagId);

    List<TaskTag> findAllByTask_IdOrderByTag_NormalizedNameAscTag_IdAsc(Long taskId);

    void deleteAllByTask_Id(Long taskId);
}
