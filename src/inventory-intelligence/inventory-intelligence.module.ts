import { Module } from '@nestjs/common';
import { InventoryAlertModule } from '../inventory-alert/inventory-alert.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { InventoryIntelligenceService } from './inventory-intelligence.service.js';

@Module({
  imports: [InventoryModule, InventoryAlertModule, KnowledgeModule],
  providers: [InventoryIntelligenceService],
})
export class InventoryIntelligenceModule {}
