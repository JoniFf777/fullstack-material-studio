package com.xiaoying.studio.common;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    @Test void uploadLimitIs413() {
        var response = handler.tooLarge(new MaxUploadSizeExceededException(10));
        assertEquals(413, response.getStatusCode().value());
        assertEquals(ErrorCode.FILE_TOO_LARGE, response.getBody().code());
        assertTrue(response.getBody().fieldErrors().isEmpty());
    }
    @Test void malformedRequestHasFieldErrors() {
        var response = handler.malformed(new IllegalArgumentException());
        assertEquals(ErrorCode.VALIDATION_FAILED, response.getBody().code());
        assertFalse(response.getBody().fieldErrors().isEmpty());
    }
}
