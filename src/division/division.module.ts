import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { DivisionController } from './division.controller.js';
import { DivisionService } from './division.service.js';

@Module({
  imports: [StorageModule],
  controllers: [DivisionController],
  providers: [DivisionService],
})
export class DivisionModule {}
