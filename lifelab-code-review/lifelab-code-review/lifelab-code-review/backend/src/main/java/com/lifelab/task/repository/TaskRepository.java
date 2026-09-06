package com.lifelab.task.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.lifelab.task.domain.Task;

public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    long countByAccount_IdAndSourceNote_YoutubeSource_Id(Long accountId, Long youtubeSourceId);

    long countByAccount_IdAndSourceNote_Id(Long accountId, Long noteId);

    List<Task> findAllByAccount_IdAndSourceNote_Id(Long accountId, Long noteId);

    Optional<Task> findByIdAndAccount_Id(Long taskId, Long accountId);

    List<Task> findAllByAccount_IdOrderByCreatedAtDescIdDesc(Long accountId);
}