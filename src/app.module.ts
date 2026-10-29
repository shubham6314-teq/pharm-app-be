import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { CategoryModule } from './category/category.module.js';
import { ContentUnitModule } from './content-unit/content-unit.module.js';
import { DivisionModule } from './division/division.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { InventoryAlertModule } from './inventory-alert/inventory-alert.module.js';
import { InventoryCopilotModule } from './inventory-copilot/inventory-copilot.module.js';
import { InventoryIntelligenceModule } from './inventory-intelligence/inventory-intelligence.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { KnowledgeModule } from './knowledge/knowledge.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { PackTypeModule } from './pack-type/pack-type.module.js';
import { ProductModule } from './product/product.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    // ObserveModule.forRoot({
    //   appKey: 'YOUR_APP_KEY',
    //   appSecret: 'YOUR_APP_SECRET',
    //   serviceId: 'pharma-app',
    // }),
    PrismaModule,
    AuthModule,
    DivisionModule,
    CategoryModule,
    PackTypeModule,
    ContentUnitModule,
    ProductModule,
    InventoryModule,
    InventoryAlertModule,
    KnowledgeModule,
    NotificationModule,
    InventoryIntelligenceModule,
    InventoryCopilotModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
