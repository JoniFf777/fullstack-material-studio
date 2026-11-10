package com.xiaoying.studio.task.engine;
import java.io.*;
import javax.imageio.ImageIO;
import com.xiaoying.studio.material.*;
import com.xiaoying.studio.task.TaskStage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
@Component
public class MaterialCheckStep implements TaskStep {
    private final FileStorage storage;private final ImageSniffer sniffer;private final int minimum;
    public MaterialCheckStep(FileStorage storage,ImageSniffer sniffer,@Value("${studio.material-min-dimension}") int minimum){this.storage=storage;this.sniffer=sniffer;this.minimum=minimum;}
    @Override public TaskStage stage(){return TaskStage.MATERIAL_CHECK;}
    @Override public String execute(TaskContext ctx){
        for(int i=0;i<ctx.materials().size();i++){
            var material=ctx.materials().get(i);String prefix="第 "+(i+1)+" 张图片";
            if(!storage.exists(material.getStorageKey()))throw new StepFailedException("MATERIAL_FILE_MISSING",prefix+"的文件已丢失，请重新上传");
            try {
                byte[] bytes=storage.read(material.getStorageKey());
                if(bytes.length!=material.getSizeBytes() || !sniffer.sniff(bytes).equals(material.getMimeType()))
                    throw new IOException("Metadata mismatch");
                var image=ImageIO.read(new ByteArrayInputStream(bytes));
                if(image==null)throw new IOException("Cannot decode image");
                if(image.getWidth()<minimum || image.getHeight()<minimum)throw new StepFailedException("MATERIAL_RESOLUTION_TOO_LOW",
                        prefix+"分辨率过低（"+image.getWidth()+"×"+image.getHeight()+"），至少需要 "+minimum+"×"+minimum);
            } catch(StepFailedException e){throw e;
            } catch(IOException | RuntimeException e){throw new StepFailedException("MATERIAL_CORRUPTED",prefix+"无法解析，可能已损坏");}
        }
        return "已检查 "+ctx.materials().size()+" 张图片";
    }
}
