package com.xiaoying.studio.auth;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service;
    private final long ttl;
    private final boolean secure;
    public AuthController(AuthService service,@Value("${studio.session-ttl-hours}") long ttl,
                          @Value("${studio.session-cookie-secure}") boolean secure) {
        this.service=service; this.ttl=ttl*3600; this.secure=secure;
    }
    public record RegisterRequest(@NotBlank(message="请输入用户名") @Pattern(regexp="^[A-Za-z0-9_]{3,20}$",message="用户名为 3–20 位字母、数字或下划线") String username,
                                  @NotNull(message="请输入密码") @Size(min=6,max=64,message="密码长度为 6–64 位") String password,
                                  @Size(max=20,message="显示名最长 20 位") String displayName) {}
    public record LoginRequest(@NotBlank(message="请输入用户名") @Size(max=20,message="用户名最长 20 位") String username,
                               @NotNull(message="请输入密码") @Size(min=6,max=64,message="密码长度为 6–64 位") String password) {}
    public record UserResponse(UserDto user) {}
    @PostMapping(value="/register",consumes=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest body) {
        return loggedIn(service.register(body.username(),body.password(),body.displayName()),201);
    }
    @PostMapping(value="/login",consumes=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UserResponse> login(@Valid @RequestBody LoginRequest body) {
        return loggedIn(service.login(body.username(),body.password()),200);
    }
    private ResponseEntity<UserResponse> loggedIn(AuthService.AuthResult result,int status) {
        return ResponseEntity.status(status).header(HttpHeaders.SET_COOKIE,cookie(result.token(),ttl))
                .header("X-User-Id",Long.toString(result.user().id())).body(new UserResponse(result.user()));
    }
    private String cookie(String token,long maxAge) {
        return ResponseCookie.from("XY_SESSION",token).httpOnly(true).secure(secure).sameSite("Lax").path("/").maxAge(maxAge).build().toString();
    }
    @PostMapping("/logout") public ResponseEntity<Void> logout(HttpServletRequest request) {
        service.logout(AuthInterceptor.token(request));
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE,cookie("",0)).build();
    }
    @GetMapping("/me") public UserResponse me(@LoginUser CurrentUser user) { return new UserResponse(service.me(user.id())); }
}
