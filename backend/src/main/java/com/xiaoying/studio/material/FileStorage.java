package com.xiaoying.studio.material;
import java.io.*;
import java.nio.file.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
@Component
public class FileStorage {
    private final Path root;
    public FileStorage(@Value("${studio.storage-root}") String root) {
        this.root=Path.of(root).toAbsolutePath().normalize();
    }
    public Path resolve(String key) {
        if(key==null || key.isBlank() || Path.of(key).isAbsolute()) throw new IllegalArgumentException("Invalid storage key");
        var path=root.resolve(key).normalize();
        if(!path.startsWith(root) || path.equals(root)) throw new IllegalArgumentException("Invalid storage key");
        return path;
    }
    public void write(String key,byte[] bytes) throws IOException {
        Path target=resolve(key);
        Files.createDirectories(target.getParent());
        Path temp=Files.createTempFile(target.getParent(),".write-",".tmp");
        try {
            Files.write(temp,bytes);
            try { Files.move(temp,target,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING); }
            catch(AtomicMoveNotSupportedException e) { Files.move(temp,target,StandardCopyOption.REPLACE_EXISTING); }
        } finally { Files.deleteIfExists(temp); }
    }
    public boolean exists(String key) { return Files.isRegularFile(resolve(key)); }
    public byte[] read(String key) throws IOException { return Files.readAllBytes(resolve(key)); }
    public void delete(String key) throws IOException { Files.deleteIfExists(resolve(key)); }
    public void deleteWork(long taskId) throws IOException {
        delete("work/"+taskId+"/generated.png");
        Files.deleteIfExists(resolve("work/"+taskId));
    }
}
