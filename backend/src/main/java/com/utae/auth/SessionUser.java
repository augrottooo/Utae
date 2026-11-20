package com.utae.auth;

import java.util.List;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public final class SessionUser extends User {
    private final String id;
    private final String role;
    public SessionUser(UserAccount user) {
        super(user.username(), user.passwordHash(), user.enabled(), true, true, true,
            List.of(new SimpleGrantedAuthority("ROLE_" + user.role())));
        this.id = user.id(); this.role = user.role();
    }
    public String id() { return id; }
    public String role() { return role; }
}
