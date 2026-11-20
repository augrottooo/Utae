package com.utae.auth;

import com.utae.common.Api;
import com.utae.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final AuthenticationManager authentication;
    private final HttpSessionSecurityContextRepository contexts;
    private final CompositeSessionAuthenticationStrategy sessions;
    public AuthController(AuthenticationManager authentication, HttpSessionSecurityContextRepository contexts,
            CompositeSessionAuthenticationStrategy sessions) {
        this.authentication = authentication; this.contexts = contexts; this.sessions = sessions;
    }
    public record Login(@NotBlank @Size(max = 80) String username, @NotBlank @Size(max = 72) String password) {}
    @GetMapping("/auth/csrf")
    Api<?> csrf(CsrfToken token) { return Api.ok(Map.of("token", token.getToken(), "headerName", token.getHeaderName())); }
    @PostMapping("/auth/login")
    Api<?> login(@RequestBody @Valid Login login, HttpServletRequest request, HttpServletResponse response) {
        try {
            var auth = authentication.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(login.username(), login.password()));
            sessions.onAuthentication(auth, request, response);
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(auth); SecurityContextHolder.setContext(context);
            contexts.saveContext(context, request, response);
            return me((SessionUser) auth.getPrincipal());
        } catch (AuthenticationException e) { throw new ApiException(401, "INVALID_CREDENTIALS", "账号或密码错误。"); }
    }
    @GetMapping("/me")
    Api<?> me(@AuthenticationPrincipal SessionUser user) {
        if (user == null) throw new ApiException(401, "UNAUTHENTICATED", "请先登录。");
        return Api.ok(Map.of("id", user.id(), "username", user.getUsername(), "role", user.role()));
    }
    @PostMapping("/auth/logout")
    Api<?> logout(HttpServletRequest request, HttpServletResponse response) {
        new SecurityContextLogoutHandler().logout(request, response, SecurityContextHolder.getContext().getAuthentication());
        new CookieClearingLogoutHandler("UTAESESSION").logout(request, response, null);
        return Api.ok(null);
    }
}
