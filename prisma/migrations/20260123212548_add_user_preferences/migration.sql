-- CreateEnum
CREATE TYPE "DateFormat" AS ENUM ('US', 'EU');

-- CreateEnum
CREATE TYPE "TemperatureUnit" AS ENUM ('FAHRENHEIT', 'CELSIUS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "date_format" "DateFormat" NOT NULL DEFAULT 'US',
ADD COLUMN     "temperature_unit" "TemperatureUnit" NOT NULL DEFAULT 'FAHRENHEIT';
