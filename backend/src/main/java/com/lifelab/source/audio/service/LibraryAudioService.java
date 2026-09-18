package com.lifelab.source.audio.service;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.exception.UnauthenticatedException;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.source.audio.domain.AudioOrigin;
import com.lifelab.source.audio.domain.AudioSource;
import com.lifelab.source.audio.domain.LibraryAudio;
import com.lifelab.source.audio.dto.AudioContent;
import com.lifelab.source.audio.dto.CreateAudioRequest;
import com.lifelab.source.audio.dto.LibraryAudioResponse;
import com.lifelab.source.audio.exception.AudioContentNotFoundException;
import com.lifelab.source.audio.exception.InvalidAudioRequestException;
import com.lifelab.source.audio.exception.LibraryAudioAlreadyExistsException;
import com.lifelab.source.audio.exception.LibraryAudioNotFoundException;
import com.lifelab.source.audio.repository.AudioSourceRepository;
import com.lifelab.source.audio.repository.LibraryAudioRepository;
import com.lifelab.source.audio.storage.LocalAudioStorage;
import com.lifelab.source.audio.storage.StoredAudio;
import com.lifelab.source.common.HttpSourceUrlValidator;

@Service
public class LibraryAudioService {

    private final AccountRepository accountRepository;
    private final AudioSourceRepository audioSourceRepository;
    private final LibraryAudioRepository libraryAudioRepository;
    private final NoteRepository noteRepository;
    private final LocalAudioStorage audioStorage;
    private final Clock clock;

    public LibraryAudioService(
            AccountRepository accountRepository,
            AudioSourceRepository audioSourceRepository,
            LibraryAudioRepository libraryAudioRepository,
            NoteRepository noteRepository,
            LocalAudioStorage audioStorage,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.audioSourceRepository = audioSourceRepository;
        this.libraryAudioRepository = libraryAudioRepository;
        this.noteRepository = noteRepository;
        this.audioStorage = audioStorage;
        this.clock = clock;
    }

    @Transactional
    public LibraryAudioResponse addAudio(Long accountId, CreateAudioRequest request) {
        Account account = requireAccount(accountId);
        String url;
        try {
            url = HttpSourceUrlValidator.normalize(request.url());
        } catch (IllegalArgumentException exception) {
            throw new InvalidAudioRequestException("url", exception.getMessage());
        }

        String title = normalizeTitle(request.title());
        OffsetDateTime now = OffsetDateTime.now(clock);
        AudioSource source = audioSourceRepository.findByOriginAndExternalUrl(AudioOrigin.EXTERNAL, url)
                .orElseGet(() -> audioSourceRepository.saveAndFlush(
                        AudioSource.external(url, now)));

        return addMembership(account, source, title, now);
    }

    @Transactional
    public LibraryAudioResponse uploadAudio(Long accountId, MultipartFile file) {
        Account account = requireAccount(accountId);
        StoredAudio stored = audioStorage.store(file);
        OffsetDateTime now = OffsetDateTime.now(clock);

        try {
            AudioSource source = audioSourceRepository.saveAndFlush(AudioSource.upload(
                    stored.storageKey(),
                    stored.originalFilename(),
                    stored.mediaType(),
                    stored.sizeBytes(),
                    now));
            return addMembership(account, source, null, now);
        } catch (RuntimeException exception) {
            audioStorage.deleteAfterFailedCreate(stored.storageKey());
            throw exception;
        }
    }

    private LibraryAudioResponse addMembership(
            Account account,
            AudioSource source,
            String title,
            OffsetDateTime now) {

        if (libraryAudioRepository.existsByAccount_IdAndAudioSource_Id(
                account.getId(), source.getId())) {
            throw new LibraryAudioAlreadyExistsException();
        }

        try {
            LibraryAudio audio = libraryAudioRepository.saveAndFlush(
                    LibraryAudio.create(account, source, title, now));
            return LibraryAudioResponse.from(audio);
        } catch (DataIntegrityViolationException exception) {
            throw new LibraryAudioAlreadyExistsException();
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<LibraryAudioResponse> getLibrary(Long accountId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("addedAt"), Sort.Order.desc("id")));
        Page<LibraryAudioResponse> result = libraryAudioRepository
                .findAllByAccount_Id(accountId, pageRequest)
                .map(LibraryAudioResponse::from);
        return PagedResponse.from(result);
    }

    @Transactional(readOnly = true)
    public LibraryAudioResponse getAudio(Long accountId, Long audioId) {
        return LibraryAudioResponse.from(findOwnedAudio(accountId, audioId));
    }

    @Transactional
    public void removeAudio(Long accountId, Long audioId) {
        libraryAudioRepository.delete(findOwnedAudio(accountId, audioId));
    }

    @Transactional(readOnly = true)
    public AudioContent getUploadedContent(Long accountId, Long sourceId) {
        boolean canAccess = libraryAudioRepository
                .existsByAccount_IdAndAudioSource_Id(accountId, sourceId)
                || noteRepository.existsByAccount_IdAndAudioSource_Id(accountId, sourceId);
        if (!canAccess) {
            throw new AudioContentNotFoundException();
        }

        AudioSource source = audioSourceRepository.findById(sourceId)
                .orElseThrow(AudioContentNotFoundException::new);
        if (source.getOrigin() != AudioOrigin.UPLOAD) {
            throw new AudioContentNotFoundException();
        }

        return new AudioContent(
                audioStorage.load(source.getStorageKey()),
                source.getMediaType(),
                source.getSizeBytes());
    }

    private Account requireAccount(Long accountId) {
        return accountRepository.findById(accountId)
                .orElseThrow(UnauthenticatedException::new);
    }

    private LibraryAudio findOwnedAudio(Long accountId, Long audioId) {
        return libraryAudioRepository.findByIdAndAccount_Id(audioId, accountId)
                .orElseThrow(LibraryAudioNotFoundException::new);
    }

    private String normalizeTitle(String title) {
        if (title == null) {
            return null;
        }
        String normalized = title.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
