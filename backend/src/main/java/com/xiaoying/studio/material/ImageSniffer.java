package com.xiaoying.studio.material;
import java.util.Arrays;
import com.xiaoying.studio.common.*;
import org.springframework.stereotype.Component;
@Component
public class ImageSniffer {
    private static final byte[] PNG={(byte)137,80,78,71,13,10,26,10};
    public String sniff(byte[] bytes) {
        if(bytes.length>=24 && Arrays.equals(Arrays.copyOf(bytes,8),PNG)
                && bytes[12]=='I' && bytes[13]=='H' && bytes[14]=='D' && bytes[15]=='R') return "image/png";
        if(bytes.length>=12 && (bytes[0]&255)==255 && (bytes[1]&255)==216 && (bytes[2]&255)==255
                && (bytes[bytes.length-2]&255)==255 && (bytes[bytes.length-1]&255)==217) return "image/jpeg";
        throw new ApiException(400,ErrorCode.FILE_TYPE_NOT_ALLOWED,"只支持真实的 JPG 或 PNG 图片");
    }
}
