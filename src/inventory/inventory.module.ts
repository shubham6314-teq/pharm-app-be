import { Module } from '@nestjs/common';
import { InventoryAlertModule } from '../inventory-alert/inventory-alert.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [InventoryAlertModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
