import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ListInventoryAlertsQueryDto } from './dto/list-inventory-alerts.query.js';
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
}
