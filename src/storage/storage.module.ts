import { Module } from '@nestjs/common';
import { LocalFileStorageService } from './local-file-storage.service.js';

@Module({
  providers: [LocalFileStorageService],
  exports: [LocalFileStorageService],
})
export class StorageModule {}
