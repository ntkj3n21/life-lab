package com.lifelab.watch.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.watch.domain.WatchSession;

import jakarta.persistence.LockModeType;

public interface WatchSessionRepository extends JpaRepository<WatchSession, Long> {

    long countByLibraryVideo_Id(Long libraryVideoId);

    @Query("""
            select
                session.libraryVideo.id as libraryVideoId,
                count(session.id) as viewCount,
                max(session.startedAt) as lastWatchedAt
            from WatchSession session
            where session.libraryVideo.account.id = :accountId
              and session.libraryVideo.id in :libraryVideoIds
              and session.validityStatus = com.lifelab.watch.domain.WatchSessionValidityStatus.VALID
            group by session.libraryVideo.id
            """)
    List<LibraryVideoWatchStatsProjection> findValidStatsByAccountIdAndLibraryVideoIds(
            @Param("accountId") Long accountId,
            @Param("libraryVideoIds") List<Long> libraryVideoIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<WatchSession> findByIdAndLibraryVideo_Account_Id(Long watchSessionId, Long accountId);
}