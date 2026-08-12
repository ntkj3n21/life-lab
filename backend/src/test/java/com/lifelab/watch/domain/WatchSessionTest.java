package com.lifelab.watch.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;

import com.lifelab.auth.domain.Account;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;

class WatchSessionTest {

    @Test
    void startCreatesPendingSessionWhenPlaybackActuallyStarts() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-11T12:00:00Z");
        Account account = Account.create("user@example.com", "password-hash", "User", now);
        YouTubeVideo source = YouTubeVideo.create(
                "source-id",
                "https://youtu.be/source-id",
                null,
                null,
                null,
                null,
                null,
                YouTubeAvailabilityStatus.UNKNOWN,
                now);
        LibraryVideo libraryVideo = LibraryVideo.create(account, source, now);

        WatchSession session = WatchSession.start(libraryVideo, now);

        assertThat(session.getId()).isNull();
        assertThat(session.getLibraryVideo()).isSameAs(libraryVideo);
        assertThat(session.getStartedAt()).isEqualTo(now);
        assertThat(session.getLastHeartbeatAt()).isEqualTo(now);
        assertThat(session.getEndedAt()).isNull();
        assertThat(session.getWatchTimeSeconds()).isZero();
        assertThat(session.getValidityStatus()).isEqualTo(WatchSessionValidityStatus.PENDING);
    }

    @Test
    void heartbeatUpdatesOnlyTrustedWatchState() {
        SessionFixture fixture = createSession();
        WatchSession session = fixture.session();
        OffsetDateTime startedAt = session.getStartedAt();
        OffsetDateTime heartbeatAt = startedAt.plusSeconds(10);

        session.applyHeartbeat(8, heartbeatAt, WatchSessionValidityStatus.VALID);

        assertThat(session.getWatchTimeSeconds()).isEqualTo(8);
        assertThat(session.getLastHeartbeatAt()).isEqualTo(heartbeatAt);
        assertThat(session.getValidityStatus()).isEqualTo(WatchSessionValidityStatus.VALID);
        assertThat(session.getStartedAt()).isEqualTo(startedAt);
        assertThat(session.getLibraryVideo()).isSameAs(fixture.libraryVideo());
        assertThat(session.getEndedAt()).isNull();
    }

    @Test
    void zeroDeltaStillUpdatesHeartbeatTimeWithoutDecreasingWatchTime() {
        WatchSession session = createSession().session();
        OffsetDateTime firstHeartbeat = session.getStartedAt().plusSeconds(5);
        OffsetDateTime secondHeartbeat = firstHeartbeat.plusSeconds(5);
        session.applyHeartbeat(4, firstHeartbeat, WatchSessionValidityStatus.PENDING);

        session.applyHeartbeat(0, secondHeartbeat, WatchSessionValidityStatus.PENDING);

        assertThat(session.getWatchTimeSeconds()).isEqualTo(4);
        assertThat(session.getLastHeartbeatAt()).isEqualTo(secondHeartbeat);
    }

    @Test
    void rejectsNegativeTrustedDelta() {
        WatchSession session = createSession().session();

        assertThatThrownBy(() -> session.applyHeartbeat(
                -1,
                session.getStartedAt().plusSeconds(1),
                WatchSessionValidityStatus.PENDING))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("trustedPlayedSecondsDelta must not be negative");
    }

    @Test
    void watchTimeOverflowNeverSilentlyWraps() {
        WatchSession session = createSession().session();
        session.applyHeartbeat(
                Integer.MAX_VALUE,
                session.getStartedAt().plusSeconds(1),
                WatchSessionValidityStatus.VALID);

        assertThatThrownBy(() -> session.applyHeartbeat(
                1,
                session.getStartedAt().plusSeconds(2),
                WatchSessionValidityStatus.VALID))
                .isInstanceOf(ArithmeticException.class);
        assertThat(session.getWatchTimeSeconds()).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    void closeAddsFinalDeltaAndStoresFinalServerState() {
        SessionFixture fixture = createSession();
        WatchSession session = fixture.session();
        OffsetDateTime startedAt = session.getStartedAt();
        OffsetDateTime closedAt = startedAt.plusSeconds(12);
        session.applyHeartbeat(5, startedAt.plusSeconds(5), WatchSessionValidityStatus.PENDING);

        session.close(3, closedAt, WatchSessionValidityStatus.VALID);

        assertThat(session.getWatchTimeSeconds()).isEqualTo(8);
        assertThat(session.getLastHeartbeatAt()).isEqualTo(closedAt);
        assertThat(session.getEndedAt()).isEqualTo(closedAt);
        assertThat(session.getValidityStatus()).isEqualTo(WatchSessionValidityStatus.VALID);
        assertThat(session.getStartedAt()).isEqualTo(startedAt);
        assertThat(session.getLibraryVideo()).isSameAs(fixture.libraryVideo());
    }

    @Test
    void closeWithZeroDeltaStillEndsSession() {
        WatchSession session = createSession().session();
        OffsetDateTime closedAt = session.getStartedAt().plusSeconds(1);

        session.close(0, closedAt, WatchSessionValidityStatus.INVALID);

        assertThat(session.getWatchTimeSeconds()).isZero();
        assertThat(session.getEndedAt()).isEqualTo(closedAt);
        assertThat(session.getLastHeartbeatAt()).isEqualTo(closedAt);
        assertThat(session.getValidityStatus()).isEqualTo(WatchSessionValidityStatus.INVALID);
    }

    @Test
    void closeRejectsNegativeDeltaAndPendingFinalStatus() {
        WatchSession session = createSession().session();
        OffsetDateTime closedAt = session.getStartedAt().plusSeconds(1);

        assertThatThrownBy(() -> session.close(-1, closedAt, WatchSessionValidityStatus.INVALID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("trustedPlayedSecondsDelta must not be negative");
        assertThatThrownBy(() -> session.close(0, closedAt, WatchSessionValidityStatus.PENDING))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Final status must be VALID, INVALID or UNDETERMINED");
        assertThat(session.getEndedAt()).isNull();
    }

    @Test
    void repeatedCloseIsRejectedWithoutReopeningSession() {
        WatchSession session = createSession().session();
        OffsetDateTime firstClose = session.getStartedAt().plusSeconds(1);
        session.close(0, firstClose, WatchSessionValidityStatus.UNDETERMINED);

        assertThatThrownBy(() -> session.close(
                1,
                firstClose.plusSeconds(1),
                WatchSessionValidityStatus.VALID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Watch session is already closed");
        assertThat(session.getEndedAt()).isEqualTo(firstClose);
        assertThat(session.getWatchTimeSeconds()).isZero();
        assertThat(session.getValidityStatus()).isEqualTo(WatchSessionValidityStatus.UNDETERMINED);
    }

    @Test
    void closeOverflowNeverSilentlyWrapsOrPartiallyCloses() {
        WatchSession session = createSession().session();
        OffsetDateTime heartbeatAt = session.getStartedAt().plusSeconds(1);
        session.applyHeartbeat(Integer.MAX_VALUE, heartbeatAt, WatchSessionValidityStatus.VALID);

        assertThatThrownBy(() -> session.close(
                1,
                heartbeatAt.plusSeconds(1),
                WatchSessionValidityStatus.VALID))
                .isInstanceOf(ArithmeticException.class);
        assertThat(session.getWatchTimeSeconds()).isEqualTo(Integer.MAX_VALUE);
        assertThat(session.getEndedAt()).isNull();
        assertThat(session.getLastHeartbeatAt()).isEqualTo(heartbeatAt);
    }

    private SessionFixture createSession() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-11T12:00:00Z");
        Account account = Account.create("user@example.com", "password-hash", "User", now);
        YouTubeVideo source = YouTubeVideo.create(
                "source-id",
                "https://youtu.be/source-id",
                null,
                null,
                null,
                null,
                null,
                YouTubeAvailabilityStatus.UNKNOWN,
                now);
        LibraryVideo libraryVideo = LibraryVideo.create(account, source, now);
        return new SessionFixture(libraryVideo, WatchSession.start(libraryVideo, now));
    }

    private record SessionFixture(LibraryVideo libraryVideo, WatchSession session) {
    }
}
