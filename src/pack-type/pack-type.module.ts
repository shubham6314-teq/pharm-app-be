import { Module } from '@nestjs/common';
import { PackTypeController } from './pack-type.controller.js';
import { PackTypeService } from './pack-type.service.js';

@Module({
  controllers: [PackTypeController],
  providers: [PackTypeService],
})
export class PackTypeModule {}
