package com.xiaoying.studio.material;
import java.time.Instant;
public record MaterialDto(long id,String originalName,String mimeType,long sizeBytes,String url,Instant createdAt) {
    public static MaterialDto from(MaterialRow m) {
        return new MaterialDto(m.getId(),m.getOriginalName(),m.getMimeType(),m.getSizeBytes(),"/api/materials/"+m.getId()+"/content",m.getCreatedAt());
    }
}
