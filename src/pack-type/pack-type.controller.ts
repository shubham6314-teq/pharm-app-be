import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreatePackTypeDto } from './dto/create-pack-type.dto.js';
import { ListPackTypesQueryDto } from './dto/list-pack-types.query.js';
import { UpdatePackTypeDto } from './dto/update-pack-type.dto.js';
import { PackTypeService } from './pack-type.service.js';

@Controller('pack-types')
export class PackTypeController {
  constructor(private readonly packTypeService: PackTypeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePackTypeDto) {
    return this.packTypeService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListPackTypesQueryDto) {
    return this.packTypeService.findAll(query);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePackTypeDto,
  ) {
    return this.packTypeService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.packTypeService.remove(id);
  }
}
