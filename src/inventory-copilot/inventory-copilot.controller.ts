import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtAccessPayload } from '../auth/auth.types.js';
import { CreateCopilotMessageDto } from './dto/create-copilot-message.dto.js';
import { COPILOT_SERVICE_UNAVAILABLE_MESSAGE } from './inventory-copilot.constants.js';
import { InventoryCopilotService } from './inventory-copilot.service.js';

@Controller('copilot/threads')
export class InventoryCopilotController {
  constructor(private readonly copilotService: InventoryCopilotService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createThread(@CurrentUser() user: JwtAccessPayload) {
    return this.copilotService.createThread(user.sub);
  }

  @Get(':id')
  findThread(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.copilotService.findThread(id, user.sub);
  }

  @Post(':id/messages')
  async createMessage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateCopilotMessageDto,
    @CurrentUser() user: JwtAccessPayload,
    @Res() response: Response,
  ) {
    await this.copilotService.findThread(id, user.sub);
    this.copilotService.ensureAvailable();

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    try {
      for await (const event of this.copilotService.ask(
        id,
        user.sub,
        dto.content,
      )) {
        response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        if (event.type === 'error') {
          break;
        }
      }
    } catch (error) {
      const message =
        error instanceof ServiceUnavailableException
          ? error.message
          : error instanceof Error
            ? error.message
            : COPILOT_SERVICE_UNAVAILABLE_MESSAGE;
      response.write(
        `event: error\ndata: ${JSON.stringify({ type: 'error', message })}\n\n`,
      );
    }

    response.end();
  }
}
