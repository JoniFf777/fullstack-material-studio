package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import java.util.Arrays;
import com.xiaoying.studio.common.ApiException;
import com.xiaoying.studio.material.ImageSniffer;
import org.junit.jupiter.api.Test;
class ImageSnifferTest {
    private final ImageSniffer sniffer=new ImageSniffer();
    @Test void identifiesActualBytes() {
        assertEquals("image/jpeg",sniffer.sniff(TestImages.jpeg(64,64)));
        assertEquals("image/png",sniffer.sniff(TestImages.png(64,64)));
    }
    @Test void rejectsTextAndTruncatedHeaders() {
        assertThrows(ApiException.class,()->sniffer.sniff(TestImages.fakeJpeg()));
        assertThrows(ApiException.class,()->sniffer.sniff(Arrays.copyOf(TestImages.jpeg(64,64),8)));
        assertThrows(ApiException.class,()->sniffer.sniff(Arrays.copyOf(TestImages.png(64,64),8)));
    }
}
