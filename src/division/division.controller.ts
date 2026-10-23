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
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DivisionService } from './division.service.js';
import { CreateDivisionDto } from './dto/create-division.dto.js';
import { ListDivisionsQueryDto } from './dto/list-divisions.query.js';
import { UpdateDivisionDto } from './dto/update-division.dto.js';
import {
  DIVISION_IMAGE_FIELD,
  divisionImageUploadOptions,
} from '../storage/division-image.upload.js';
import { MulterExceptionFilter } from '../storage/multer-exception.filter.js';

@Controller('divisions')
@UseFilters(MulterExceptionFilter)
export class DivisionController {
  constructor(private readonly divisionService: DivisionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor(DIVISION_IMAGE_FIELD, divisionImageUploadOptions),
  )
  create(
    @Body() createDivisionDto: CreateDivisionDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.divisionService.create(createDivisionDto, image);
  }

  @Get()
  findAll(@Query() query: ListDivisionsQueryDto) {
    return this.divisionService.findAll(query);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor(DIVISION_IMAGE_FIELD, divisionImageUploadOptions),
  )
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateDivisionDto: UpdateDivisionDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.divisionService.update(id, updateDivisionDto, image);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.divisionService.remove(id);
  }
}
