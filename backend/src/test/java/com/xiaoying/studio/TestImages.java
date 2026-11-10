package com.xiaoying.studio;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import javax.imageio.ImageIO;
public final class TestImages {
    private TestImages() {}
    public static byte[] jpeg(int w,int h) { return image(w,h,"jpg",Color.ORANGE); }
    public static byte[] png(int w,int h) { return image(w,h,"png",Color.BLUE); }
    public static byte[] image(int w,int h,String format,Color color) {
        try {
            var image=new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB);
            var g=image.createGraphics(); g.setColor(color);g.fillRect(0,0,w,h);g.dispose();
            var output=new ByteArrayOutputStream(); ImageIO.write(image,format,output);return output.toByteArray();
        } catch(IOException e) { throw new UncheckedIOException(e); }
    }
    public static byte[] fakeJpeg() { return "This is text".getBytes(java.nio.charset.StandardCharsets.UTF_8); }
}
