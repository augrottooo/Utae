package com.utae.common;

public record Api<T>(String apiVersion, String code, String message, T data) {
    public static <T> Api<T> ok(T data) { return new Api<>("utae-api-v1", "OK", "", data); }
    public static Api<Void> error(String code, String message) {
        return new Api<>("utae-api-v1", code, message, null);
    }
}
