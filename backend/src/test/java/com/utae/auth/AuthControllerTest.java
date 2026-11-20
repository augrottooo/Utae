package com.utae.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.utae.common.ApiErrors;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import({ApiErrors.class, AuthControllerTest.Config.class})
class AuthControllerTest {
    @TestConfiguration static class Config {
        @Bean AuthenticationManager authenticationManager() {
            return authentication -> {
                if ("alice".equals(authentication.getName()) && "correct-password".equals(authentication.getCredentials()))
                    return UsernamePasswordAuthenticationToken.authenticated(
                        new SessionUser(new UserAccount("server-id", "alice", "hash", "USER", true)), null,
                        AuthorityUtils.createAuthorityList("ROLE_USER"));
                throw new org.springframework.security.authentication.BadCredentialsException("bad");
            };
        }
        @Bean UserMapper userMapper() { return org.mockito.Mockito.mock(UserMapper.class); }
        @Bean HttpSessionSecurityContextRepository contexts() { return new HttpSessionSecurityContextRepository(); }
        @Bean HttpSessionCsrfTokenRepository csrf() { return new HttpSessionCsrfTokenRepository(); }
        @Bean CompositeSessionAuthenticationStrategy sessions(HttpSessionCsrfTokenRepository csrf) {
            return new CompositeSessionAuthenticationStrategy(List.of(
                new org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy(),
                new org.springframework.security.web.csrf.CsrfAuthenticationStrategy(csrf)));
        }
        @Bean org.springframework.security.web.SecurityFilterChain testFilterChain(org.springframework.security.config.annotation.web.builders.HttpSecurity http,
                ObjectMapper json, HttpSessionSecurityContextRepository contexts, HttpSessionCsrfTokenRepository csrf) throws Exception {
            http.securityContext(c -> c.securityContextRepository(contexts))
                .csrf(c -> c.csrfTokenRepository(csrf).csrfTokenRequestHandler(new org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler()))
                .authorizeHttpRequests(c -> c.requestMatchers("/api/auth/csrf", "/api/auth/login").permitAll().anyRequest().authenticated())
                .exceptionHandling(c -> c.authenticationEntryPoint((req, res, e) -> {
                    res.setStatus(401); res.setContentType("application/json"); json.writeValue(res.getOutputStream(), com.utae.common.Api.error("UNAUTHENTICATED", "请先登录。"));
                }).accessDeniedHandler((req, res, e) -> {
                    res.setStatus(403); res.setContentType("application/json"); json.writeValue(res.getOutputStream(), com.utae.common.Api.error("FORBIDDEN", "请求未获授权。"));
                }));
            return http.build();
        }
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Test void loginSetsHttpOnlySessionAndMeUsesServerIdentity() throws Exception {
        var login = json.writeValueAsBytes(java.util.Map.of("username", "alice", "password", "correct-password"));
        var csrf = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        String token = json.readTree(csrf.getResponse().getContentAsByteArray()).path("data").path("token").asText();
        var session = csrf.getRequest().getSession(false);
        var loginResponse = mvc.perform(post("/api/auth/login").session((org.springframework.mock.web.MockHttpSession) session)
                .header("X-CSRF-TOKEN", token).contentType("application/json").content(login))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value("server-id"));
        mvc.perform(get("/api/me").session((org.springframework.mock.web.MockHttpSession) loginResponse.andReturn().getRequest().getSession(false)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value("server-id"));
    }
    @Test void unauthenticatedMeAndCsrfProtectedWritesFail() throws Exception {
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(post("/api/auth/logout")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
