import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { CategoryModule } from './category/category.module.js';
import { ContentUnitModule } from './content-unit/content-unit.module.js';
import { DivisionModule } from './division/division.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { PackTypeModule } from './pack-type/pack-type.module.js';
import { ProductModule } from './product/product.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
