
-- Recharge packs table
CREATE TABLE public.recharge_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator text NOT NULL,  -- e.g. 'Grameenphone', 'Robi', etc.
  name text NOT NULL,
  details text NOT NULL,
  validity text NOT NULL,
  price numeric NOT NULL,
  type text NOT NULL DEFAULT 'regular',  -- 'drive' or 'regular'
  sub_category text,  -- 'internet', 'minutes', 'bundles', 'callrates'
  badge text,
  tag text,  -- 'Hot', 'New', 'Limited', 'Popular'
  highlight boolean NOT NULL DEFAULT false,
  cashback numeric DEFAULT 0,  -- drive packs commission
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recharge_packs ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage recharge packs"
  ON public.recharge_packs FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- All authenticated users can read active packs
CREATE POLICY "Authenticated users can read active packs"
  ON public.recharge_packs FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_recharge_packs_updated_at
  BEFORE UPDATE ON public.recharge_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.recharge_packs;

-- Seed the existing hardcoded packs
INSERT INTO public.recharge_packs (operator, name, details, validity, price, type, sub_category, badge, tag, highlight, cashback, sort_order) VALUES
-- GP Drive
('Grameenphone','MyPlan Unlimited','Unlimited calls + 10GB data + 200 SMS','30 days',399,'drive',NULL,'Best Value','Hot',true,20,1),
('Grameenphone','Weekend Blast','5GB weekend + 100 min any net','3 days',79,'drive',NULL,'Limited','Limited',true,5,2),
('Grameenphone','GP Exclusive Deal','3GB + 200 min + 1GB night bonus','10 days',149,'drive',NULL,'New','New',false,8,3),
('Grameenphone','Super Saver 7','7GB high-speed + 120 min + 80 SMS','7 days',189,'drive',NULL,'Popular','Popular',false,10,4),
-- GP Regular Internet
('Grameenphone','1GB Starter','1GB 4G data','3 days',29,'regular','internet',NULL,NULL,false,0,10),
('Grameenphone','3GB Weekly','3GB 4G data','7 days',69,'regular','internet','Popular',NULL,true,0,11),
('Grameenphone','10GB Monthly','10GB 4G data','30 days',189,'regular','internet','Best Deal',NULL,false,0,12),
('Grameenphone','20GB+ Monthly','20GB 4G + 10GB night data','30 days',329,'regular','internet',NULL,NULL,false,0,13),
('Grameenphone','50GB Max','50GB 4G data, no throttle','30 days',699,'regular','internet',NULL,NULL,false,0,14),
-- GP Regular Minutes
('Grameenphone','100 Min','100 min GP-GP calls','7 days',35,'regular','minutes',NULL,NULL,false,0,20),
('Grameenphone','200 Min','200 min any network','14 days',89,'regular','minutes',NULL,NULL,true,0,21),
('Grameenphone','500 Min','500 min any net + 50 SMS','30 days',179,'regular','minutes','Popular',NULL,false,0,22),
('Grameenphone','1000 Min','1000 min GP-GP','30 days',299,'regular','minutes',NULL,NULL,false,0,23),
-- GP Regular Bundles
('Grameenphone','Starter Bundle','500MB + 100 min + 50 SMS','7 days',89,'regular','bundles',NULL,NULL,false,0,30),
('Grameenphone','Smart Bundle','2GB + 300 min + 100 SMS','30 days',249,'regular','bundles','Popular',NULL,true,0,31),
('Grameenphone','Premium Bundle','5GB + 600 min + 200 SMS','30 days',449,'regular','bundles',NULL,NULL,false,0,32),
('Grameenphone','Ultimate Bundle','15GB + Unlimited min & SMS','30 days',799,'regular','bundles','Top Tier',NULL,false,0,33),
-- GP Regular Call Rates
('Grameenphone','GP-GP Rate','0.25 paisa/sec on-net','Ongoing',20,'regular','callrates',NULL,NULL,false,0,40),
('Grameenphone','Any Net Rate','0.60 paisa/sec off-net','Ongoing',30,'regular','callrates',NULL,NULL,false,0,41),
('Grameenphone','FnF Pack','10 FnF at 0.10 paisa/sec','30 days',25,'regular','callrates',NULL,NULL,true,0,42),

-- Robi Drive
('Robi','Robi Unlimited','Unlimited calls + 8GB data + 150 SMS','30 days',349,'drive',NULL,'Best Value','Hot',true,18,1),
('Robi','Robi Weekend','3GB weekend + 80 min any net','3 days',65,'drive',NULL,'Limited','Limited',false,4,2),
('Robi','Robi Smart Deal','2GB + 180 min + 1GB night bonus','10 days',129,'drive',NULL,'New','New',false,7,3),
('Robi','Robi Weekly Pro','5GB + 100 min + 60 SMS','7 days',159,'drive',NULL,'Popular','Popular',true,9,4),
-- Robi Regular Internet
('Robi','500MB Pack','500MB 4G data','3 days',24,'regular','internet',NULL,NULL,false,0,10),
('Robi','2GB Weekly','2GB 4G data','7 days',59,'regular','internet','Popular',NULL,true,0,11),
('Robi','8GB Monthly','8GB 4G data','30 days',169,'regular','internet','Best Deal',NULL,false,0,12),
('Robi','15GB+ Monthly','15GB 4G + 5GB night','30 days',299,'regular','internet',NULL,NULL,false,0,13),
-- Robi Regular Minutes
('Robi','50 Min','50 min Robi-Robi','3 days',20,'regular','minutes',NULL,NULL,false,0,20),
('Robi','150 Min','150 min any net','7 days',59,'regular','minutes',NULL,NULL,true,0,21),
('Robi','400 Min','400 min any net','28 days',149,'regular','minutes','Popular',NULL,false,0,22),
('Robi','800 Min','800 min Robi-Robi','30 days',259,'regular','minutes',NULL,NULL,false,0,23),
-- Robi Regular Bundles
('Robi','Mini Bundle','300MB + 60 min + 30 SMS','7 days',69,'regular','bundles',NULL,NULL,false,0,30),
('Robi','Value Bundle','1.5GB + 250 min + 80 SMS','30 days',199,'regular','bundles','Popular',NULL,true,0,31),
('Robi','Super Bundle','4GB + 500 min + 150 SMS','30 days',399,'regular','bundles',NULL,NULL,false,0,32),
-- Robi Regular Call Rates
('Robi','Robi-Robi','0.20 paisa/sec on-net','Ongoing',18,'regular','callrates',NULL,NULL,false,0,40),
('Robi','Any Network','0.55 paisa/sec off-net','Ongoing',28,'regular','callrates',NULL,NULL,true,0,41),
('Robi','FnF 5','5 FnF at 0.15 paisa/sec','30 days',20,'regular','callrates',NULL,NULL,false,0,42),

-- Banglalink Drive
('Banglalink','BL Freedom Pack','Unlimited calls + 9GB data + 200 SMS','30 days',379,'drive',NULL,'Best Value','Hot',true,19,1),
('Banglalink','BL Weekly Star','4GB weekend + 120 min any net','3 days',75,'drive',NULL,'Limited','Limited',false,5,2),
('Banglalink','BL Flash Offer','2.5GB + 200 min + 80 SMS','10 days',139,'drive',NULL,'New','New',false,7,3),
('Banglalink','BL Social Pack','5GB social media + 100 min','7 days',169,'drive',NULL,'Popular','Popular',true,9,4),
-- Banglalink Regular Internet
('Banglalink','500MB Starter','500MB 4G data','3 days',22,'regular','internet',NULL,NULL,false,0,10),
('Banglalink','2.5GB Weekly','2.5GB 4G data','7 days',65,'regular','internet','Popular',NULL,true,0,11),
('Banglalink','9GB Monthly','9GB 4G data','30 days',175,'regular','internet','Best Deal',NULL,false,0,12),
('Banglalink','18GB+ Monthly','18GB 4G + 8GB night','30 days',310,'regular','internet',NULL,NULL,false,0,13),
-- Banglalink Regular Minutes
('Banglalink','75 Min','75 min BL-BL calls','5 days',25,'regular','minutes',NULL,NULL,false,0,20),
('Banglalink','180 Min','180 min any network','10 days',69,'regular','minutes',NULL,NULL,true,0,21),
('Banglalink','450 Min','450 min any net','30 days',159,'regular','minutes','Popular',NULL,false,0,22),
('Banglalink','900 Min','900 min BL-BL','30 days',289,'regular','minutes',NULL,NULL,false,0,23),
-- Banglalink Regular Bundles
('Banglalink','Combo Saver','400MB + 80 min + 40 SMS','7 days',79,'regular','bundles',NULL,NULL,false,0,30),
('Banglalink','Combo Plus','2GB + 280 min + 100 SMS','30 days',229,'regular','bundles','Popular',NULL,true,0,31),
('Banglalink','Mega Combo','5GB + 550 min + 180 SMS','30 days',419,'regular','bundles',NULL,NULL,false,0,32),
-- Banglalink Regular Call Rates
('Banglalink','BL-BL Rate','0.22 paisa/sec on-net','Ongoing',19,'regular','callrates',NULL,NULL,false,0,40),
('Banglalink','Other Net','0.58 paisa/sec off-net','Ongoing',29,'regular','callrates',NULL,NULL,true,0,41),
('Banglalink','FnF 8','8 FnF at 0.12 paisa/sec','30 days',22,'regular','callrates',NULL,NULL,false,0,42),

-- Teletalk Drive
('Teletalk','Agami Unlimited','Unlimited calls + 5GB data + 100 SMS','30 days',299,'drive',NULL,'Best Value','Hot',true,15,1),
('Teletalk','Smart Weekend','2GB weekend + 80 min','3 days',55,'drive',NULL,'Limited','Limited',false,3,2),
('Teletalk','Student Special','1.5GB + 150 min + 50 SMS','7 days',89,'drive',NULL,'New','New',false,5,3),
-- Teletalk Regular Internet
('Teletalk','300MB Starter','300MB 4G data','3 days',19,'regular','internet',NULL,NULL,false,0,10),
('Teletalk','1.5GB Weekly','1.5GB 4G data','7 days',49,'regular','internet','Popular',NULL,true,0,11),
('Teletalk','6GB Monthly','6GB 4G data','30 days',149,'regular','internet','Best Deal',NULL,false,0,12),
-- Teletalk Regular Minutes
('Teletalk','60 Min','60 min TT-TT calls','5 days',22,'regular','minutes',NULL,NULL,false,0,20),
('Teletalk','150 Min','150 min any net','10 days',55,'regular','minutes',NULL,NULL,true,0,21),
('Teletalk','350 Min','350 min any net','30 days',139,'regular','minutes','Popular',NULL,false,0,22),
-- Teletalk Regular Bundles
('Teletalk','Basic Bundle','250MB + 50 min + 20 SMS','7 days',59,'regular','bundles',NULL,NULL,false,0,30),
('Teletalk','Value Bundle','1GB + 200 min + 60 SMS','30 days',179,'regular','bundles','Popular',NULL,true,0,31),
-- Teletalk Regular Call Rates
('Teletalk','TT-TT Rate','0.18 paisa/sec on-net','Ongoing',15,'regular','callrates',NULL,NULL,true,0,40),
('Teletalk','Other Net','0.50 paisa/sec off-net','Ongoing',25,'regular','callrates',NULL,NULL,false,0,41),

-- Airtel Drive
('Airtel','Airtel Infinity','Unlimited calls + 12GB data + 200 SMS','30 days',429,'drive',NULL,'Best Value','Hot',true,22,1),
('Airtel','Weekly Champ','4GB + 130 min any net','7 days',99,'drive',NULL,'Limited','Limited',false,6,2),
('Airtel','Airtel Exclusive','3GB + 250 min + 1GB social','10 days',159,'drive',NULL,'New','New',false,8,3),
('Airtel','Daily Boost Pro','2GB + 60 min + unlimited SMS','5 days',89,'drive',NULL,'Popular','Popular',true,5,4),
-- Airtel Regular Internet
('Airtel','750MB Starter','750MB 4G data','3 days',27,'regular','internet',NULL,NULL,false,0,10),
('Airtel','3GB Weekly','3GB 4G data','7 days',69,'regular','internet','Popular',NULL,true,0,11),
('Airtel','12GB Monthly','12GB 4G data','30 days',199,'regular','internet','Best Deal',NULL,false,0,12),
('Airtel','25GB+ Monthly','25GB 4G + 12GB night','30 days',349,'regular','internet',NULL,NULL,false,0,13),
-- Airtel Regular Minutes
('Airtel','80 Min','80 min Airtel-Airtel','5 days',28,'regular','minutes',NULL,NULL,false,0,20),
('Airtel','200 Min','200 min any net','14 days',79,'regular','minutes',NULL,NULL,true,0,21),
('Airtel','500 Min','500 min any net','30 days',179,'regular','minutes','Popular',NULL,false,0,22),
('Airtel','1200 Min','1200 min Airtel-Airtel','30 days',329,'regular','minutes',NULL,NULL,false,0,23),
-- Airtel Regular Bundles
('Airtel','Starter Combo','500MB + 100 min + 50 SMS','7 days',85,'regular','bundles',NULL,NULL,false,0,30),
('Airtel','Power Combo','3GB + 350 min + 120 SMS','30 days',269,'regular','bundles','Popular',NULL,true,0,31),
('Airtel','Max Combo','8GB + 700 min + 250 SMS','30 days',499,'regular','bundles',NULL,NULL,false,0,32),
-- Airtel Regular Call Rates
('Airtel','Airtel-Airtel','0.20 paisa/sec on-net','Ongoing',20,'regular','callrates',NULL,NULL,false,0,40),
('Airtel','Off-Net','0.55 paisa/sec off-net','Ongoing',30,'regular','callrates',NULL,NULL,true,0,41),
('Airtel','FnF 10','10 FnF at 0.10 paisa/sec','30 days',28,'regular','callrates',NULL,NULL,false,0,42);
