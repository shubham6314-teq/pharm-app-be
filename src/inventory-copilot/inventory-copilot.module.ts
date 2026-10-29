import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { InventoryCopilotController } from './inventory-copilot.controller.js';
import { InventoryCopilotService } from './inventory-copilot.service.js';

@Module({
  imports: [InventoryModule, KnowledgeModule],
  controllers: [InventoryCopilotController],
  providers: [InventoryCopilotService],
})
export class InventoryCopilotModule {}
