package com.xiaoying.studio.material;
import java.io.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import com.xiaoying.studio.auth.TokenHasher;
import com.xiaoying.studio.common.*;
import com.xiaoying.studio.template.TemplateService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MaterialService {
    public static final long MAX_BYTES=10*1024*1024;
    private final MaterialMapper mapper;
    private final TemplateService templates;
    private final ImageSniffer sniffer;
    private final FileStorage storage;
    private final Clock clock;
    public MaterialService(MaterialMapper mapper,TemplateService templates,ImageSniffer sniffer,FileStorage storage,Clock clock) {
        this.mapper=mapper;this.templates=templates;this.sniffer=sniffer;this.storage=storage;this.clock=clock;
    }
    @Transactional
    public MaterialDto upload(long userId,MultipartFile file,String templateId) throws IOException {
        if(file.isEmpty()) throw new ApiException(400,ErrorCode.FILE_EMPTY,"请选择非空图片文件");
        if(file.getSize()>MAX_BYTES) throw new ApiException(413,ErrorCode.FILE_TOO_LARGE,"文件不能超过 10MB");
        byte[] bytes=file.getBytes();
        String mime=sniffer.sniff(bytes);
        if(templateId!=null) {
            var template=templates.require(templateId);
            if(!template.acceptedMimeTypes().contains(mime)) throw new ApiException(400,ErrorCode.FILE_TYPE_NOT_ALLOWED,"该模板不支持此图片类型");
            if(bytes.length>template.maxFileSizeBytes()) throw new ApiException(400,ErrorCode.FILE_TOO_LARGE,"图片超过该模板的大小限制");
        }
        var now=Times.now(clock);
        String key="materials/"+userId+"/"+DateTimeFormatter.ofPattern("yyyyMM").withZone(ZoneOffset.UTC).format(now)
                +"/"+UUID.randomUUID()+(mime.equals("image/png")?".png":".jpg");
        storage.write(key,bytes);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if(status!=STATUS_COMMITTED) try { storage.delete(key); } catch(IOException ignored) { }
            }
        });
        var material=new MaterialRow();
        material.setUserId(userId);material.setCreatedAt(now);material.setStorageKey(key);
        String name=file.getOriginalFilename()==null?"image":file.getOriginalFilename().replace('\\','/');
        name=name.substring(name.lastIndexOf('/')+1);
        material.setOriginalName(name.isBlank()?"image":name.substring(0,Math.min(name.length(),255)));
        material.setMimeType(mime);material.setSizeBytes(bytes.length);material.setSha256(TokenHasher.sha256(bytes));
        mapper.insert(material);
        return MaterialDto.from(material);
    }
    public MaterialRow content(long id,long userId) {
        var material=mapper.owned(id,userId);
        if(material==null || !storage.exists(material.getStorageKey())) throw new ApiException(404,ErrorCode.MATERIAL_NOT_FOUND,"素材不存在");
        return material;
    }
}
