package com.lifelab.watch.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import com.lifelab.watch.domain.WatchSession;

import jakarta.persistence.LockModeType;

public interface WatchSessionRepository extends JpaRepository<WatchSession, Long> {

    long countByLibraryVideo_Id(Long libraryVideoId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<WatchSession> findByIdAndLibraryVideo_Account_Id(Long watchSessionId, Long accountId);
}
