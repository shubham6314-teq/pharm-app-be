import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';

@Module({
  imports: [StorageModule],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
