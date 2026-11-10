import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.*;
import java.util.Random;
import javax.imageio.ImageIO;

/** Run from repository root with JDK 21. Only JDK APIs; fixed seeds, no fonts. */
public class GenerateDemoAssets {
    private static final String[] IDS = {"hot-avatar", "hot-film", "pet-sticker", "pet-duo",
            "festival-hug", "festival-card", "travel-postcard", "travel-triptych", "wedding-invite"};
    private static final Color[] COLORS = {new Color(224,153,78), new Color(186,120,87),
            new Color(110,166,132), new Color(84,147,156), new Color(210,96,106),
            new Color(190,84,105), new Color(73,148,186), new Color(91,126,183), new Color(169,132,174)};
    public static void main(String[] args) throws IOException {
        Path covers = Path.of("backend/src/main/resources/static/demo/covers");
        Path samples = Path.of("samples");
        Files.createDirectories(covers);
        Files.createDirectories(samples);
        for (int i = 0; i < IDS.length; i++) {
            ImageIO.write(picture(720, 960, COLORS[i], i + 100), "png", covers.resolve(IDS[i] + ".png").toFile());
        }
        ImageIO.write(picture(1200, 1200, COLORS[0], 1), "jpg", samples.resolve("photo-1.jpg").toFile());
        ImageIO.write(picture(1200, 900, COLORS[2], 2), "jpg", samples.resolve("photo-2.jpg").toFile());
        ImageIO.write(picture(900, 1200, COLORS[6], 3), "png", samples.resolve("photo-3.png").toFile());
        var large = picture(2400, 1800, COLORS[4], 4);
        var random = new Random(42);
        for (int y = 0; y < large.getHeight(); y++) {
            for (int x = 0; x < large.getWidth(); x++) {
                int base = large.getRGB(x, y);
                int noise = random.nextInt(121) - 60;
                int red = clamp(((base >> 16) & 255) + noise);
                int green = clamp(((base >> 8) & 255) + noise);
                int blue = clamp((base & 255) + noise);
                large.setRGB(x, y, (red << 16) | (green << 8) | blue);
            }
        }
        ImageIO.write(large, "jpg", samples.resolve("large-photo.jpg").toFile());
        ImageIO.write(picture(32, 32, COLORS[2], 5), "png", samples.resolve("tiny-32.png").toFile());
        Files.writeString(samples.resolve("not-image.jpg"), "This is text, not a JPEG image.\n");
    }
    private static int clamp(int v) { return Math.max(0, Math.min(255, v)); }
    private static BufferedImage picture(int w, int h, Color color, long seed) {
        var image = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setPaint(new GradientPaint(0, 0, color.brighter(), w, h, color.darker().darker()));
            g.fillRect(0, 0, w, h);
            var random = new Random(seed);
            for (int i = 0; i < 8; i++) {
                g.setColor(new Color(255, 255, 255, 20 + random.nextInt(55)));
                int d = w / 5 + random.nextInt(Math.max(1, w / 2));
                g.fillOval(random.nextInt(w) - d / 2, random.nextInt(h) - d / 2, d, d);
            }
            g.setColor(new Color(24, 38, 52, 95));
            var mountain = new Polygon(new int[]{0, w / 3, w / 2, w * 3 / 4, w, w, 0},
                    new int[]{h * 4 / 5, h / 2, h * 3 / 4, h / 3, h * 2 / 3, h, h}, 7);
            g.fillPolygon(mountain);
            g.setColor(new Color(255, 242, 203, 210));
            g.fillOval(w * 2 / 3, h / 6, w / 6, w / 6);
        } finally { g.dispose(); }
        return image;
    }
}
