import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsGateway } from './notifications.gateway.js';

@Module({
  imports: [AuthModule],
  providers: [NotificationsGateway],
})
export class NotificationModule {}
