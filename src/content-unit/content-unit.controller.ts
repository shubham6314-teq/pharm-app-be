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
import { ContentUnitService } from './content-unit.service.js';
import { CreateContentUnitDto } from './dto/create-content-unit.dto.js';
import { ListContentUnitsQueryDto } from './dto/list-content-units.query.js';
import { UpdateContentUnitDto } from './dto/update-content-unit.dto.js';

@Controller('content-units')
export class ContentUnitController {
  constructor(private readonly contentUnitService: ContentUnitService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateContentUnitDto) {
    return this.contentUnitService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListContentUnitsQueryDto) {
    return this.contentUnitService.findAll(query);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateContentUnitDto,
  ) {
    return this.contentUnitService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.contentUnitService.remove(id);
  }
}
