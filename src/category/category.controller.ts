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
import { CategoryService } from './category.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesQueryDto } from './dto/list-categories.query.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import {
  IMAGE_FIELD,
  imageUploadOptions,
} from '../storage/division-image.upload.js';
import { MulterExceptionFilter } from '../storage/multer-exception.filter.js';

@Controller('categories')
@UseFilters(MulterExceptionFilter)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor(IMAGE_FIELD, imageUploadOptions))
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.categoryService.create(createCategoryDto, image);
  }

  @Get()
  findAll(@Query() query: ListCategoriesQueryDto) {
    return this.categoryService.findAll(query);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor(IMAGE_FIELD, imageUploadOptions))
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.categoryService.update(id, updateCategoryDto, image);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.categoryService.remove(id);
  }
}
