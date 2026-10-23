import { Module } from '@nestjs/common';
import { ContentUnitController } from './content-unit.controller.js';
import { ContentUnitService } from './content-unit.service.js';

@Module({
  controllers: [ContentUnitController],
  providers: [ContentUnitService],
})
export class ContentUnitModule {}
