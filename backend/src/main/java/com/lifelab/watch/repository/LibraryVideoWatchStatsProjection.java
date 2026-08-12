package com.lifelab.watch.repository;

import java.time.OffsetDateTime;

public interface LibraryVideoWatchStatsProjection {

    Long getLibraryVideoId();

    Long getViewCount();

    OffsetDateTime getLastWatchedAt();
}