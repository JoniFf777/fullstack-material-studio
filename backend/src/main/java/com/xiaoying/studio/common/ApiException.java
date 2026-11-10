package com.xiaoying.studio.common;

import java.util.List;

public class ApiException extends RuntimeException {
    private final int status;
    private final ApiErrorResponse body;
    public ApiException(int status, ErrorCode code, String message) {
        this(status, code, message, List.of());
    }
    public ApiException(int status, ErrorCode code, String message, List<ApiErrorResponse.FieldError> fields) {
        super(message);
        this.status = status;
        this.body = new ApiErrorResponse(code, message, fields);
    }
    public int status() { return status; }
    public ApiErrorResponse body() { return body; }
    public static ApiException validation(String field, String message) {
        return new ApiException(400, ErrorCode.VALIDATION_FAILED, "请求参数不合法",
                List.of(new ApiErrorResponse.FieldError(field, message)));
    }
}
