-- CreateIndex
CREATE INDEX "chat_members_user_id_idx" ON "chat_members"("user_id");

-- CreateIndex
CREATE INDEX "messages_chat_id_created_at_idx" ON "messages"("chat_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "one_time_prekeys_user_id_key_id_idx" ON "one_time_prekeys"("user_id", "key_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
