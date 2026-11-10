INSERT INTO template_category (code, name, sort_order) VALUES
('hot','热门',1), ('pets','萌宠',2), ('festival','节日',3), ('travel','旅行',4), ('wedding','婚礼',5);

INSERT INTO template (id, category_code, title, description, cover_url, required_image_count,
                      accepted_mime_types, max_file_size_bytes, sort_order, enabled) VALUES
('hot-avatar','hot','迷你头像','上传 1 张清晰的照片，生成一枚头像。限制较严，用来演示大小校验','/demo/covers/hot-avatar.png',1,'image/jpeg,image/png',204800,1,1),
('hot-film','hot','复古胶片','上传 1 张照片，模拟生成胶片风格作品。只接受 JPG，用来演示类型校验','/demo/covers/hot-film.png',1,'image/jpeg',5242880,2,1),
('pet-sticker','pets','萌宠贴纸','上传 1 张宠物照片，模拟生成一张贴纸','/demo/covers/pet-sticker.png',1,'image/jpeg,image/png',5242880,1,1),
('pet-duo','pets','双宠合影','上传 2 张宠物照片，拼成一张合影','/demo/covers/pet-duo.png',2,'image/jpeg,image/png',5242880,2,1),
('festival-hug','festival','节日拥抱','上传 2 张照片，模拟生成节日拥抱合照','/demo/covers/festival-hug.png',2,'image/jpeg,image/png',5242880,1,1),
('festival-card','festival','新年贺卡','上传 1 张 PNG 图片，模拟生成新年贺卡。只接受 PNG','/demo/covers/festival-card.png',1,'image/png',5242880,2,1),
('travel-postcard','travel','旅行明信片','上传 2 张旅行照片，模拟生成一张明信片','/demo/covers/travel-postcard.png',2,'image/jpeg,image/png',5242880,1,1),
('travel-triptych','travel','旅途三联拼','上传 3 张照片，拼成三联画','/demo/covers/travel-triptych.png',3,'image/jpeg,image/png',5242880,2,1),
('wedding-invite','wedding','婚礼请柬','上传 2 张照片，模拟生成婚礼请柬','/demo/covers/wedding-invite.png',2,'image/jpeg,image/png',5242880,1,0);

-- Demonstration accounts only. BCrypt strength 10, generated with BCryptPasswordEncoder.
INSERT INTO app_user (username, password_hash, display_name, created_at) VALUES
('demo','$2a$10$NR94kATDahEJVFxfMf/JKOaary9jwIjbAFelHavFKY9CHaAqPo86e','演示用户','2026-11-10 08:00:00.000'),
('alice','$2a$10$QeDAz2LSEvUkh0oWttX66OV4P1VQVjWtvBaKLnGtkP5R4Yrt6Hsbm','Alice','2026-11-10 08:00:00.000');
