-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "ciphertext" TEXT,
ADD COLUMN     "signal_type" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "prekey_bundles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "identity_key" TEXT NOT NULL,
    "signed_prekey_id" INTEGER NOT NULL,
    "signed_prekey" TEXT NOT NULL,
    "signed_prekey_sig" TEXT NOT NULL,

    CONSTRAINT "prekey_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_prekeys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_id" INTEGER NOT NULL,
    "public_key" TEXT NOT NULL,

    CONSTRAINT "one_time_prekeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prekey_bundles_user_id_key" ON "prekey_bundles"("user_id");

-- AddForeignKey
ALTER TABLE "prekey_bundles" ADD CONSTRAINT "prekey_bundles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_time_prekeys" ADD CONSTRAINT "one_time_prekeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
