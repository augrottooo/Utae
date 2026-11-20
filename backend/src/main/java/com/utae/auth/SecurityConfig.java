package com.utae.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.utae.common.Api;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import java.util.UUID;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean ApplicationRunner bootstrapMaintainer(UserMapper mapper, PasswordEncoder encoder,
            @Value("${utae.bootstrap.username:}") String username,
            @Value("${utae.bootstrap.password:}") String password) {
        return args -> {
            if (username.isBlank() && password.isBlank()) return;
            if (username.isBlank() || password.length() < 16)
                throw new IllegalStateException("Explicit bootstrap needs a username and a password of at least 16 characters.");
            if (mapper.find(username) == null) mapper.create(UUID.randomUUID().toString(), username, encoder.encode(password), "MAINTAINER");
        };
    }
    @Bean UserDetailsService users(UserMapper mapper) {
        return username -> {
            UserAccount user = mapper.find(username);
            if (user == null) throw new UsernameNotFoundException("Invalid credentials");
            return new SessionUser(user);
        };
    }
    @Bean AuthenticationManager authenticationManager(UserDetailsService users, PasswordEncoder encoder) {
        var provider = new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(encoder);
        return new ProviderManager(provider);
    }
    @Bean HttpSessionSecurityContextRepository securityContexts() { return new HttpSessionSecurityContextRepository(); }
    @Bean HttpSessionCsrfTokenRepository csrfTokens() { return new HttpSessionCsrfTokenRepository(); }
    @Bean CompositeSessionAuthenticationStrategy sessionStrategy(HttpSessionCsrfTokenRepository csrf) {
        return new CompositeSessionAuthenticationStrategy(java.util.List.of(
            new ChangeSessionIdAuthenticationStrategy(), new CsrfAuthenticationStrategy(csrf)));
    }
    @Bean SecurityFilterChain filterChain(HttpSecurity http, ObjectMapper json,
            HttpSessionSecurityContextRepository contexts, HttpSessionCsrfTokenRepository csrf) throws Exception {
        http.securityContext(c -> c.securityContextRepository(contexts))
            .csrf(c -> c.csrfTokenRepository(csrf).csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
            .authorizeHttpRequests(c -> c
                .requestMatchers("/api/auth/csrf", "/api/auth/login").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/songs/**", "/api/assets/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.HEAD, "/api/assets/**").permitAll()
                .requestMatchers("/api/**").authenticated().anyRequest().denyAll())
            .exceptionHandling(c -> c
                .authenticationEntryPoint((req, res, e) -> {
                    res.setStatus(401); res.setContentType("application/json;charset=UTF-8");
                    json.writeValue(res.getOutputStream(), Api.error("UNAUTHENTICATED", "请先登录。"));
                })
                .accessDeniedHandler((req, res, e) -> {
                    res.setStatus(403); res.setContentType("application/json;charset=UTF-8");
                    json.writeValue(res.getOutputStream(), Api.error("FORBIDDEN", "请求未获授权或 CSRF token 已过期。"));
                }))
            .requestCache(c -> c.disable()).formLogin(c -> c.disable())
            .httpBasic(c -> c.disable()).logout(c -> c.disable());
        return http.build();
    }
}
