-- Gaps found when loading the reference sheet.
insert into public.category_keywords (category, keyword) values
  ('Hoodies', 'zip'), ('Hoodies', 'half zip'), ('Hoodies', 'quarter zip'),
  ('Tops', 'button up'), ('Tops', 'button down'), ('Tops', 'short sleeve'), ('Tops', 'blouse'),
  ('Skirts', 'skirt'),
  ('Sets', 'set'), ('Sets', 'tracksuit'),
  ('Footwear', 'timbs'), ('Footwear', 'clogs'), ('Footwear', 'mules'),
  ('Tech', 'mousepad'), ('Tech', 'mouse pad'), ('Tech', 'switches'), ('Tech', 'keyboard case'),
  ('Accessories', 'card holder'), ('Accessories', 'lanyard'), ('Accessories', 'tie')
on conflict (keyword) do nothing;
