import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { InventoryAlertStatus } from '../../generated/prisma/client.js';
import { toNumber } from '../../inventory/dto/transform-strings.js';
import { MAX_ALERT_PAGE_SIZE } from '../inventory-alert.constants.js';

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) {
    return true;
  }

  if (value === 'false' || value === false) {
    return false;
  }

  return value;
}

export class ListInventoryAlertsQueryDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(MAX_ALERT_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsEnum(InventoryAlertStatus)
  status?: InventoryAlertStatus;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}
