import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';

@Module({
  imports: [StorageModule],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
