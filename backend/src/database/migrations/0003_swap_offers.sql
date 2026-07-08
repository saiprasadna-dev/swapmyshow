-- In-chat price offers. A swap can hold one pending offer at a time:
-- `offer_price` is the proposed price and `offer_by` is the user who proposed
-- it. Accepting copies offer_price into agreed_price and clears both. Forward
-- only — never edit an applied migration.
ALTER TABLE swaps ADD COLUMN offer_price INTEGER;
ALTER TABLE swaps ADD COLUMN offer_by INTEGER;
