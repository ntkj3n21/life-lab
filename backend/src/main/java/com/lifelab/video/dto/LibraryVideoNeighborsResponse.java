package com.lifelab.video.dto;

public record LibraryVideoNeighborsResponse(
        LibraryVideoResponse previous,
        LibraryVideoResponse next) {
}
