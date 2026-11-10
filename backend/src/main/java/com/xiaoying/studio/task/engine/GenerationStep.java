package com.xiaoying.studio.task.engine;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import javax.imageio.ImageIO;
import com.xiaoying.studio.material.FileStorage;
import com.xiaoying.studio.task.TaskStage;
import org.springframework.stereotype.Component;
@Component
public class GenerationStep implements TaskStep {
    private final FileStorage storage;
    public GenerationStep(FileStorage storage){this.storage=storage;}
    @Override public TaskStage stage(){return TaskStage.GENERATING;}
    @Override public String execute(TaskContext ctx){
        var canvas=new BufferedImage(720,960,BufferedImage.TYPE_INT_RGB);
        var g=canvas.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setColor(Color.getHSBColor((ctx.templateId().hashCode()&0xffff)/65536f,.3f,.25f));g.fillRect(0,0,720,960);
            int count=ctx.materials().size();
            for(int i=0;i<count;i++){
                Rectangle cell=layout(count,i);
                var image=ImageIO.read(storage.resolve(ctx.materials().get(i).getStorageKey()).toFile());
                if(image==null)throw new IOException("Invalid image");
                double scale=Math.min(cell.width/(double)image.getWidth(),cell.height/(double)image.getHeight());
                int w=Math.max(1,(int)(image.getWidth()*scale)),h=Math.max(1,(int)(image.getHeight()*scale));
                g.drawImage(image,cell.x+(cell.width-w)/2,cell.y+(cell.height-h)/2,w,h,null);
            }
            var output=new ByteArrayOutputStream();
            if(!ImageIO.write(canvas,"png",output))throw new IOException("PNG writer unavailable");
            storage.write(ctx.workKey(),output.toByteArray());
            return "已生成 720×960 的中间图";
        } catch(IOException | RuntimeException e){throw new StepFailedException("GENERATION_FAILED","生成中间图失败");
        } finally {g.dispose();}
    }
    private Rectangle layout(int count,int i){
        return switch(count){
            case 1->new Rectangle(24,24,672,912);
            case 2->new Rectangle(24,24+i*468,672,444);
            case 3->i==0?new Rectangle(24,24,672,444):new Rectangle(24+(i-1)*348,492,324,444);
            case 4->new Rectangle(24+(i%2)*348,24+(i/2)*468,324,444);
            default->throw new IllegalArgumentException("Unsupported material count");
        };
    }
}
