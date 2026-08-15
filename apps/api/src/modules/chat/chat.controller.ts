import { Body, Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

// FR-7.1: public, like the wireframe's Live Chat card — any storefront
// visitor (guest or signed in) can use ChrisPa Agent. No JwtAuthGuard.
// No per-route throttle override — unlike the earlier Claude-API-backed
// version, a keyword match costs nothing per request, so the app-wide
// default (100/min/IP, see app.module.ts) is enough.
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('message')
  send(@Body() dto: ChatMessageDto) {
    return this.chat.reply(dto);
  }
}
