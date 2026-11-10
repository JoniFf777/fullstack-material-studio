package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import java.nio.file.*;
import com.xiaoying.studio.material.FileStorage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
class FileStorageTest {
    @TempDir Path root;
    @Test void writesAtomicallyAndRejectsEscapes() throws Exception {
        var storage=new FileStorage(root.toString());
        storage.write("materials/1/a.png",new byte[]{1,2,3});
        assertArrayEquals(new byte[]{1,2,3},storage.read("materials/1/a.png"));
        try(var files=Files.list(root.resolve("materials/1"))) { assertEquals(1,files.count()); }
        assertThrows(IllegalArgumentException.class,()->storage.resolve("../outside"));
        assertThrows(IllegalArgumentException.class,()->storage.resolve(root.toString()));
    }
}
