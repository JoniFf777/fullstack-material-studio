package com.xiaoying.studio.material;
import java.io.IOException;
import com.xiaoying.studio.auth.*;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
@RestController @RequestMapping("/api/materials")
public class MaterialController {
    private final MaterialService service;
    private final FileStorage storage;
    public MaterialController(MaterialService service,FileStorage storage) { this.service=service;this.storage=storage; }
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MaterialDto> upload(@LoginUser CurrentUser user,@RequestPart MultipartFile file,
            @RequestParam(required=false) String templateId) throws IOException {
        return ResponseEntity.status(201).body(service.upload(user.id(),file,templateId));
    }
    @GetMapping("/{id}/content") public ResponseEntity<Resource> content(@LoginUser CurrentUser user,@PathVariable long id) {
        var material=service.content(id,user.id());
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(material.getMimeType()))
                .header(HttpHeaders.CACHE_CONTROL,"private, max-age=86400")
                .body(new FileSystemResource(storage.resolve(material.getStorageKey())));
    }
}
