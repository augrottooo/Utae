package com.utae.auth;
public record UserAccount(String id, String username, String passwordHash, String role, boolean enabled) {}
