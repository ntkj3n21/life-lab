package com.lifelab.task.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import com.lifelab.task.domain.Task;

public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    long countByAccount_IdAndSourceNote_YoutubeSource_Id(Long accountId, Long youtubeSourceId);

    long countByAccount_IdAndSourceNote_Id(Long accountId, Long noteId);

    long countByAccount_IdAndCategory_Id(Long accountId, Long categoryId);

    List<Task> findAllByAccount_IdAndSourceNote_Id(Long accountId, Long noteId);

    @EntityGraph(attributePaths = "category")
    Optional<Task> findByIdAndAccount_Id(Long taskId, Long accountId);

    @EntityGraph(attributePaths = "category")
    List<Task> findAllByAccount_IdOrderByCreatedAtDescIdDesc(Long accountId);

    @Override
    @EntityGraph(attributePaths = "category")
    Page<Task> findAll(Specification<Task> specification, Pageable pageable);
}
