package com.xiaoying.studio.common;

import java.util.List;

public record ApiErrorResponse(ErrorCode code, String message, List<FieldError> fieldErrors) {
    public record FieldError(String field, String message) {}
}
