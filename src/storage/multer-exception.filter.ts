import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { IMAGE_TOO_LARGE_MESSAGE } from './storage.constants.js';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    const error =
      exception.code === 'LIMIT_FILE_SIZE'
        ? new BadRequestException(IMAGE_TOO_LARGE_MESSAGE)
        : new BadRequestException(exception.message);

    response.status(error.getStatus()).json(error.getResponse());
  }
}
