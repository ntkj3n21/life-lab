package com.lifelab.source.audio.storage;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AudioStorageProperties.class)
public class AudioStorageConfiguration {
}
