package com.xiaoying.studio.common;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> api(ApiException e) {
        return ResponseEntity.status(e.status()).body(e.body());
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> validation(MethodArgumentNotValidException e) {
        var fields = e.getBindingResult().getFieldErrors().stream()
                .map(f -> new ApiErrorResponse.FieldError(f.getField(), f.getDefaultMessage())).toList();
        return api(new ApiException(400, ErrorCode.VALIDATION_FAILED, "请求参数不合法", fields));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class, HandlerMethodValidationException.class})
    public ResponseEntity<ApiErrorResponse> malformed(Exception e) {
        return api(ApiException.validation("request", "请求字段格式不正确"));
    }
    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiErrorResponse> missingFile(Exception e) {
        return api(new ApiException(400, ErrorCode.FILE_EMPTY, "请选择图片文件"));
    }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> tooLarge(Exception e) {
        return api(new ApiException(413, ErrorCode.FILE_TOO_LARGE, "文件不能超过 10MB"));
    }
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> missing(Exception e) {
        return api(new ApiException(404, ErrorCode.TASK_NOT_FOUND, "资源不存在"));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> unexpected(Exception e) {
        log.error("Unexpected request failure", e);
        return ResponseEntity.internalServerError().body(new ApiErrorResponse(
                ErrorCode.INTERNAL_ERROR, "系统内部错误，请稍后重试", List.of()));
    }
}
