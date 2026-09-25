-- Admin allowlist (profiles.is_admin is set on sign-up from this table).
insert into public.admin_emails (email) values ('lachlan.j.ta@gmail.com');

-- Featured reference sheet tabs.
insert into public.sources (sheet_id, gid, tab_name, is_featured) values
  ('1QJyne-Hqh91sWs_UMdyibKa1cN9Bt03E7imF-mZ-gbA', '1201104608', 'FASHION', true),
  ('1QJyne-Hqh91sWs_UMdyibKa1cN9Bt03E7imF-mZ-gbA', '1209966016', 'TECH', true);

-- Starter keyword taxonomy (editable from /admin). Matched against product names.
insert into public.category_keywords (category, keyword) values
  ('Tops', 'shirt'), ('Tops', 't-shirt'), ('Tops', 'tee'), ('Tops', 'tank'), ('Tops', 'polo'),
  ('Tops', 'jersey'), ('Tops', 'longsleeve'), ('Tops', 'long sleeve'), ('Tops', 'top'),
  ('Knitwear', 'sweater'), ('Knitwear', 'knit'), ('Knitwear', 'cardigan'), ('Knitwear', 'jumper'),
  ('Hoodies', 'hoodie'), ('Hoodies', 'sweatshirt'), ('Hoodies', 'crewneck'), ('Hoodies', 'zip up'), ('Hoodies', 'zip-up'),
  ('Outerwear', 'jacket'), ('Outerwear', 'coat'), ('Outerwear', 'puffer'), ('Outerwear', 'parka'),
  ('Outerwear', 'vest'), ('Outerwear', 'gilet'), ('Outerwear', 'windbreaker'), ('Outerwear', 'blazer'),
  ('Pants', 'pants'), ('Pants', 'sweatpants'), ('Pants', 'trousers'), ('Pants', 'jeans'), ('Pants', 'denim'),
  ('Pants', 'cargo'), ('Pants', 'joggers'), ('Pants', 'trackpants'),
  ('Shorts', 'shorts'), ('Shorts', 'jorts'),
  ('Footwear', 'shoe'), ('Footwear', 'shoes'), ('Footwear', 'sneaker'), ('Footwear', 'sneakers'),
  ('Footwear', 'boot'), ('Footwear', 'boots'), ('Footwear', 'slides'), ('Footwear', 'sandals'),
  ('Footwear', 'loafers'), ('Footwear', 'trainers'),
  ('Headwear', 'hat'), ('Headwear', 'cap'), ('Headwear', 'beanie'), ('Headwear', 'balaclava'),
  ('Bags', 'bag'), ('Bags', 'backpack'), ('Bags', 'tote'), ('Bags', 'wallet'),
  ('Accessories', 'belt'), ('Accessories', 'socks'), ('Accessories', 'scarf'), ('Accessories', 'gloves'),
  ('Accessories', 'sunglasses'), ('Accessories', 'glasses'), ('Accessories', 'keychain'),
  ('Jewellery', 'ring'), ('Jewellery', 'necklace'), ('Jewellery', 'chain'), ('Jewellery', 'bracelet'),
  ('Jewellery', 'earring'), ('Jewellery', 'earrings'), ('Jewellery', 'watch'),
  ('Tech', 'keycap'), ('Tech', 'keyboard'), ('Tech', 'headphones'), ('Tech', 'earbuds'), ('Tech', 'charger'),
  ('Tech', 'case'), ('Tech', 'mouse'), ('Tech', 'speaker'), ('Tech', 'cable');
