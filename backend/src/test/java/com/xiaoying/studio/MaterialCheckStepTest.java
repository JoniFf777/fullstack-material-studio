package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import java.nio.file.Path;
import java.util.*;
import com.xiaoying.studio.material.*;
import com.xiaoying.studio.task.*;
import com.xiaoying.studio.task.engine.*;
import com.xiaoying.studio.simulation.SimulationPlan;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
class MaterialCheckStepTest {
    @TempDir Path root;
    private TaskContext context(MaterialRow row){return new TaskContext(1,1,"pet-sticker",List.of(row),new SimulationPlan("NONE",Map.of()));}
    private MaterialRow material(byte[] bytes){var row=new MaterialRow();row.setStorageKey("materials/1/input.png");row.setMimeType("image/png");row.setSizeBytes(bytes.length);return row;}
    @Test void missingAndCorruptedImagesUseBusinessCodes() throws Exception {
        var storage=new FileStorage(root.toString());var step=new MaterialCheckStep(storage,new ImageSniffer(),64);
        byte[] bytes=TestImages.png(96,96);var row=material(bytes);
        assertEquals("MATERIAL_FILE_MISSING",assertThrows(StepFailedException.class,()->step.execute(context(row))).code());
        storage.write(row.getStorageKey(),bytes);assertEquals("已检查 1 张图片",step.execute(context(row)));
        row.setSizeBytes(bytes.length+1);assertEquals("MATERIAL_CORRUPTED",assertThrows(StepFailedException.class,()->step.execute(context(row))).code());
        row.setSizeBytes(bytes.length);row.setMimeType("image/jpeg");assertEquals("MATERIAL_CORRUPTED",assertThrows(StepFailedException.class,()->step.execute(context(row))).code());
    }
    @Test void validHeaderWithInvalidImageIsRejectedDuringDecode() throws Exception {
        var storage=new FileStorage(root.toString());var step=new MaterialCheckStep(storage,new ImageSniffer(),64);
        byte[] bytes=Arrays.copyOf(TestImages.png(96,96),24);var row=material(bytes);storage.write(row.getStorageKey(),bytes);
        assertEquals("MATERIAL_CORRUPTED",assertThrows(StepFailedException.class,()->step.execute(context(row))).code());
    }
}
