package com.xiaoying.studio.task.engine;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import javax.imageio.ImageIO;
import com.xiaoying.studio.material.FileStorage;
import com.xiaoying.studio.task.TaskStage;
import org.springframework.stereotype.Component;
@Component
public class ResultAssemblyStep implements TaskStep {
    private final FileStorage storage;
    public ResultAssemblyStep(FileStorage storage){this.storage=storage;}
    @Override public TaskStage stage(){return TaskStage.RESULT_ASSEMBLY;}
    @Override public String execute(TaskContext ctx){
        try {
            var source=ImageIO.read(storage.resolve(ctx.workKey()).toFile());
            if(source==null)throw new IOException("Intermediate image missing");
            var jpeg=new BufferedImage(source.getWidth(),source.getHeight(),BufferedImage.TYPE_INT_RGB);
            var g=jpeg.createGraphics();try {g.setColor(Color.WHITE);g.fillRect(0,0,jpeg.getWidth(),jpeg.getHeight());g.drawImage(source,0,0,null);}finally{g.dispose();}
            var output=new ByteArrayOutputStream();if(!ImageIO.write(jpeg,"jpg",output))throw new IOException("JPEG writer unavailable");
            String key="results/"+ctx.userId()+"/"+ctx.taskId()+".jpg";
            storage.write(key,output.toByteArray());storage.deleteWork(ctx.taskId());ctx.resultKey(key);
            return "已输出结果图片";
        } catch(IOException | RuntimeException e){throw new StepFailedException("RESULT_WRITE_FAILED","结果文件写入失败");}
    }
}
