-- Request coordinates are now optional: the compose screen only asks for
-- State + LGA, and GPS can be denied. Without coords, NEARBY matching runs on
-- the state/LGA scope alone instead of a distance ranking.
ALTER TABLE "requests" ALTER COLUMN "lat" DROP NOT NULL;
ALTER TABLE "requests" ALTER COLUMN "lng" DROP NOT NULL;
