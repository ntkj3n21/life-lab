package com.lifelab.common.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@WebMvcTest(controllers = GlobalExceptionHandlerTest.UploadLimitController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({ GlobalExceptionHandler.class, GlobalExceptionHandlerTest.UploadLimitController.class })
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void oversizedImageUploadUsesImageErrorContract() throws Exception {
        mockMvc.perform(post("/api/library/images/upload"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IMAGE"))
                .andExpect(jsonPath("$.message").value("Request validation failed."))
                .andExpect(jsonPath("$.fieldErrors.file")
                        .value("exceeds the configured maximum upload size"));
    }

    @Test
    void oversizedAudioUploadUsesAudioErrorContract() throws Exception {
        mockMvc.perform(post("/api/library/audio/upload"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_AUDIO"))
                .andExpect(jsonPath("$.message").value("Request validation failed."))
                .andExpect(jsonPath("$.fieldErrors.file")
                        .value("exceeds the configured maximum upload size"));
    }

    @Test
    void oversizedUnknownMultipartEndpointUsesGenericValidationContract()
            throws Exception {

        mockMvc.perform(post("/test/oversized-upload"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Request validation failed."))
                .andExpect(jsonPath("$.fieldErrors.file")
                        .value("exceeds the configured maximum upload size"));
    }

    @RestController
    static class UploadLimitController {

        @PostMapping("/api/library/images/upload")
        void imageUpload() {
            throw new MaxUploadSizeExceededException(1L);
        }

        @PostMapping("/api/library/audio/upload")
        void audioUpload() {
            throw new MaxUploadSizeExceededException(1L);
        }

        @PostMapping("/test/oversized-upload")
        void genericUpload() {
            throw new MaxUploadSizeExceededException(1L);
        }
    }
}
