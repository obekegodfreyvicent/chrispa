import { IsString, MaxLength } from 'class-validator';

// The keyword-matched ChatService (see chat.service.ts) answers purely from
// the current message — no conversation history needed server-side, unlike
// the earlier Claude-API-backed version.
export class ChatMessageDto {
  @IsString()
  @MaxLength(2000)
  message!: string;
}
