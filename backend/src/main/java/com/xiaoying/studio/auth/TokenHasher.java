package com.xiaoying.studio.auth;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.HexFormat;
public final class TokenHasher {
    private TokenHasher() {}
    public static String hash(String token) { return sha256(token.getBytes(StandardCharsets.UTF_8)); }
    public static String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
