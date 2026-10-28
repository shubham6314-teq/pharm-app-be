import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { parseFrontendOrigins } from '../app.setup.js';
import { TokenService } from '../auth/token.service.js';
import {
  INVENTORY_ALERT_ANALYSIS_FAILED,
  INVENTORY_ALERT_ANALYSIS_READY,
  INVENTORY_ALERT_CREATED,
  INVENTORY_ALERT_RESOLVED,
  type InventoryAlertEvent,
} from '../inventory-alert/inventory-alert.constants.js';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const originHeader = client.handshake.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    const allowedOrigins = parseFrontendOrigins(
      this.configService.get<string>('FRONTEND_ORIGIN'),
    );

    if (origin && !allowedOrigins.includes(origin)) {
      client.disconnect();
      return;
    }

    const token = this.readToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      await this.tokenService.verifyAccessToken(token);
    } catch (error) {
      this.logger.debug('Rejected notification socket', error);
      client.disconnect();
    }
  }

  @OnEvent(INVENTORY_ALERT_CREATED)
  alertCreated(event: InventoryAlertEvent): void {
    this.server?.emit(INVENTORY_ALERT_CREATED, event);
  }

  @OnEvent(INVENTORY_ALERT_RESOLVED)
  alertResolved(event: InventoryAlertEvent): void {
    this.server?.emit(INVENTORY_ALERT_RESOLVED, event);
  }

  @OnEvent(INVENTORY_ALERT_ANALYSIS_READY)
  analysisReady(event: InventoryAlertEvent): void {
    this.server?.emit(INVENTORY_ALERT_ANALYSIS_READY, event);
  }

  @OnEvent(INVENTORY_ALERT_ANALYSIS_FAILED)
  analysisFailed(event: InventoryAlertEvent): void {
    this.server?.emit(INVENTORY_ALERT_ANALYSIS_FAILED, event);
  }

  private readToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = client.handshake.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!header) {
      return undefined;
    }

    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' ? token : undefined;
  }
}
