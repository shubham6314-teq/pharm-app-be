import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePackTypeDto } from './create-pack-type.dto.js';

describe('CreatePackTypeDto', () => {
  it('uppercases the code and trims labels', async () => {
    const dto = plainToInstance(CreatePackTypeDto, {
      name: '  Ampoule  ',
      code: '  ampoule  ',
      singularLabel: '  ampoule  ',
      pluralLabel: '  ampoules  ',
      sortOrder: '70',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Ampoule');
    expect(dto.code).toBe('AMPOULE');
    expect(dto.singularLabel).toBe('ampoule');
    expect(dto.pluralLabel).toBe('ampoules');
    expect(dto.sortOrder).toBe(70);
  });

  it('rejects missing required fields', async () => {
    const dto = plainToInstance(CreatePackTypeDto, {});
    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(
      expect.arrayContaining(['name', 'code', 'singularLabel', 'pluralLabel']),
    );
  });
});
