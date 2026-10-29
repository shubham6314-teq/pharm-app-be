import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtAccessPayload } from '../auth/auth.types.js';
import { ListInventoryAlertsQueryDto } from './dto/list-inventory-alerts.query.js';
import { UpdateRecommendationDto } from './dto/update-recommendation.dto.js';
import { InventoryAlertService } from './inventory-alert.service.js';

@Controller('inventory-alerts')
export class InventoryAlertController {
  constructor(private readonly inventoryAlertService: InventoryAlertService) {}

  @Get()
  findAll(@Query() query: ListInventoryAlertsQueryDto) {
    return this.inventoryAlertService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.inventoryAlertService.findOne(id);
  }

  @Patch(':id/dismiss')
  dismiss(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.inventoryAlertService.dismiss(id);
  }

  @Patch(':id/recommendation')
  decideRecommendation(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateRecommendationDto,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.inventoryAlertService.decideRecommendation(id, user.sub, dto);
  }
}
