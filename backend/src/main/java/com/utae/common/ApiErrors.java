package com.utae.common;

import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import jakarta.validation.ConstraintViolationException;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<Api<Void>> api(ApiException e) {
        return ResponseEntity.status(e.status).body(Api.error(e.code, e.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
        HandlerMethodValidationException.class, MethodArgumentTypeMismatchException.class,
        MissingServletRequestParameterException.class, ConstraintViolationException.class})
    ResponseEntity<Api<Void>> invalid(Exception e) {
        return ResponseEntity.badRequest().body(Api.error("INVALID_INPUT", "请求参数不正确。"));
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<Api<Void>> internal(Exception e) {
        LoggerFactory.getLogger(ApiErrors.class).error("API failed: {}", e.getClass().getSimpleName());
        return ResponseEntity.internalServerError().body(Api.error("INTERNAL_ERROR", "服务暂时不可用。"));
    }
}
