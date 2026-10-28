import { Module } from '@nestjs/common';
import { InventoryAlertController } from './inventory-alert.controller.js';
import { InventoryAlertService } from './inventory-alert.service.js';

@Module({
  controllers: [InventoryAlertController],
  providers: [InventoryAlertService],
  exports: [InventoryAlertService],
})
export class InventoryAlertModule {}
