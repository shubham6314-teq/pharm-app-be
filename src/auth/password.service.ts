import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from './auth.constants.js';

@Injectable()
export class PasswordService {
  hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  }

  compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}
