package com.lifelab.task.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.task.domain.TaskTag;
import com.lifelab.task.domain.TaskTagId;

public interface TaskTagRepository extends JpaRepository<TaskTag, TaskTagId> {

    long countByTag_Id(Long tagId);

    List<TaskTag> findAllByTask_IdOrderByTag_NormalizedNameAscTag_IdAsc(Long taskId);

    @Query("""
            SELECT taskTag
            FROM TaskTag taskTag
            JOIN FETCH taskTag.tag tag
            WHERE taskTag.task.id IN :taskIds
            ORDER BY taskTag.task.id ASC, tag.normalizedName ASC, tag.id ASC
            """)
    List<TaskTag> findAllWithTagByTaskIdIn(@Param("taskIds") Collection<Long> taskIds);

    void deleteAllByTask_Id(Long taskId);
}
