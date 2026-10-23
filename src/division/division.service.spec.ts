import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DivisionStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalFileStorageService } from '../storage/local-file-storage.service.js';
import {
  DEFAULT_DIVISION_PAGE,
  DEFAULT_DIVISION_PAGE_SIZE,
  DIVISION_NOT_FOUND_MESSAGE,
  DIVISION_UPDATE_EMPTY_MESSAGE,
} from './division.constants.js';
import { DivisionService } from './division.service.js';
import { CreateDivisionDto } from './dto/create-division.dto.js';

describe('DivisionService', () => {
  let service: DivisionService;
  let prisma: {
    division: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    category: {
      count: ReturnType<typeof vi.fn>;
    };
  };
  let files: {
    saveDivisionImage: ReturnType<typeof vi.fn>;
    removeIfManaged: ReturnType<typeof vi.fn>;
  };

  const createDto: CreateDivisionDto = {
    name: 'Cardiology Division',
    code: 'CARD',
    description: 'Heart and blood pressure medicines',
  };

  const createdDivision = {
    id: '11111111-1111-1111-1111-111111111111',
    name: createDto.name,
    code: createDto.code,
    description: createDto.description,
    imageUrl: null as string | null,
    status: DivisionStatus.ACTIVE,
    isDeleted: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const imageFile = {
    originalname: 'card.png',
    mimetype: 'image/png',
    buffer: Buffer.from('png'),
    size: 3,
  } as Express.Multer.File;

  beforeEach(async () => {
    prisma = {
      division: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      category: {
        count: vi.fn(),
      },
    };
    files = {
      saveDivisionImage: vi.fn(),
      removeIfManaged: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DivisionService,
        { provide: PrismaService, useValue: prisma },
        { provide: LocalFileStorageService, useValue: files },
      ],
    }).compile();

    service = module.get(DivisionService);
  });

  it('creates a division successfully', async () => {
    prisma.division.findFirst.mockResolvedValue(null);
    prisma.division.create.mockResolvedValue(createdDivision);

    await expect(service.create(createDto)).resolves.toEqual(createdDivision);
    expect(files.saveDivisionImage).not.toHaveBeenCalled();
    expect(prisma.division.create).toHaveBeenCalledWith({
      data: {
        name: createDto.name,
        code: createDto.code,
        description: createDto.description,
        imageUrl: undefined,
      },
    });
  });

  it('creates a division with an uploaded image', async () => {
    const imageUrl = '/uploads/divisions/card.png';
    const withImage = { ...createdDivision, imageUrl };
    prisma.division.findFirst.mockResolvedValue(null);
    files.saveDivisionImage.mockResolvedValue(imageUrl);
    prisma.division.create.mockResolvedValue(withImage);

    await expect(service.create(createDto, imageFile)).resolves.toEqual(
      withImage,
    );
    expect(files.saveDivisionImage).toHaveBeenCalledWith(imageFile);
    expect(prisma.division.create).toHaveBeenCalledWith({
      data: {
        name: createDto.name,
        code: createDto.code,
        description: createDto.description,
        imageUrl,
      },
    });
  });

  it('creates a division when optional fields are omitted', async () => {
    const minimalDto: CreateDivisionDto = {
      name: 'Neurology Division',
      code: 'NEURO',
    };
    const minimalDivision = {
      ...createdDivision,
      name: minimalDto.name,
      code: minimalDto.code,
      description: null,
      imageUrl: null,
    };

    prisma.division.findFirst.mockResolvedValue(null);
    prisma.division.create.mockResolvedValue(minimalDivision);

    await expect(service.create(minimalDto)).resolves.toEqual(minimalDivision);
    expect(prisma.division.create).toHaveBeenCalledWith({
      data: {
        name: minimalDto.name,
        code: minimalDto.code,
        description: undefined,
        imageUrl: undefined,
      },
    });
  });

  it('returns 409 when the division name already exists', async () => {
    prisma.division.findFirst.mockResolvedValue({
      ...createdDivision,
      code: 'OTHER',
    });

    await expect(service.create(createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.division.create).not.toHaveBeenCalled();
    expect(files.saveDivisionImage).not.toHaveBeenCalled();
  });

  it('returns 409 when the division code already exists', async () => {
    prisma.division.findFirst.mockResolvedValue({
      ...createdDivision,
      name: 'Other Division',
    });

    await expect(service.create(createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.division.create).not.toHaveBeenCalled();
  });

  it('returns 409 when create hits a unique name constraint', async () => {
    prisma.division.findFirst.mockResolvedValue(null);
    prisma.division.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['name'] },
      }),
    );

    await expect(service.create(createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns 409 when create hits a unique code constraint', async () => {
    prisma.division.findFirst.mockResolvedValue(null);
    prisma.division.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['code'] },
      }),
    );

    await expect(service.create(createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('removes an uploaded file when create fails', async () => {
    const imageUrl = '/uploads/divisions/card.png';
    prisma.division.findFirst.mockResolvedValue(null);
    files.saveDivisionImage.mockResolvedValue(imageUrl);
    prisma.division.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['name'] },
      }),
    );

    await expect(service.create(createDto, imageFile)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(files.removeIfManaged).toHaveBeenCalledWith(imageUrl);
  });

  it('lists divisions with default pagination', async () => {
    prisma.division.findMany.mockResolvedValue([createdDivision]);
    prisma.division.count.mockResolvedValue(1);

    await expect(service.findAll({})).resolves.toEqual({
      data: [createdDivision],
      meta: {
        page: DEFAULT_DIVISION_PAGE,
        limit: DEFAULT_DIVISION_PAGE_SIZE,
        total: 1,
        totalPages: 1,
      },
    });
    expect(prisma.division.findMany).toHaveBeenCalledWith({
      where: { isDeleted: false },
      skip: 0,
      take: DEFAULT_DIVISION_PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.division.count).toHaveBeenCalledWith({
      where: { isDeleted: false },
    });
  });

  it('lists divisions with a requested page and limit', async () => {
    prisma.division.findMany.mockResolvedValue([]);
    prisma.division.count.mockResolvedValue(25);

    await expect(service.findAll({ page: 3, limit: 10 })).resolves.toEqual({
      data: [],
      meta: {
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    });
    expect(prisma.division.findMany).toHaveBeenCalledWith({
      where: { isDeleted: false },
      skip: 20,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns an empty page when no divisions exist', async () => {
    prisma.division.findMany.mockResolvedValue([]);
    prisma.division.count.mockResolvedValue(0);

    await expect(service.findAll({})).resolves.toEqual({
      data: [],
      meta: {
        page: DEFAULT_DIVISION_PAGE,
        limit: DEFAULT_DIVISION_PAGE_SIZE,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('updates a division', async () => {
    const updated = {
      ...createdDivision,
      name: 'Updated Cardiology',
      status: DivisionStatus.INACTIVE,
    };
    prisma.division.findFirst
      .mockResolvedValueOnce(createdDivision)
      .mockResolvedValueOnce(null);
    prisma.division.update.mockResolvedValue(updated);

    await expect(
      service.update(createdDivision.id, {
        name: 'Updated Cardiology',
        status: DivisionStatus.INACTIVE,
      }),
    ).resolves.toEqual(updated);
    expect(prisma.division.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: createdDivision.id,
        isDeleted: false,
      },
    });
    expect(prisma.division.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        id: { not: createdDivision.id },
        OR: [{ name: 'Updated Cardiology' }],
      },
    });
    expect(prisma.division.update).toHaveBeenCalledWith({
      where: { id: createdDivision.id },
      data: {
        name: 'Updated Cardiology',
        status: DivisionStatus.INACTIVE,
      },
    });
  });

  it('replaces an image on update', async () => {
    const existing = {
      ...createdDivision,
      imageUrl: '/uploads/divisions/old.png',
    };
    const imageUrl = '/uploads/divisions/new.png';
    const updated = { ...existing, imageUrl };
    prisma.division.findFirst.mockResolvedValueOnce(existing);
    files.saveDivisionImage.mockResolvedValue(imageUrl);
    prisma.division.update.mockResolvedValue(updated);

    await expect(
      service.update(createdDivision.id, {}, imageFile),
    ).resolves.toEqual(updated);
    expect(prisma.division.update).toHaveBeenCalledWith({
      where: { id: createdDivision.id },
      data: { imageUrl },
    });
    expect(files.removeIfManaged).toHaveBeenCalledWith(existing.imageUrl);
  });

  it('clears optional fields on update', async () => {
    const updated = {
      ...createdDivision,
      description: null,
    };
    prisma.division.findFirst.mockResolvedValueOnce(createdDivision);
    prisma.division.update.mockResolvedValue(updated);

    await expect(
      service.update(createdDivision.id, {
        description: null,
      }),
    ).resolves.toEqual(updated);
    expect(prisma.division.update).toHaveBeenCalledWith({
      where: { id: createdDivision.id },
      data: {
        description: null,
      },
    });
  });

  it('rejects an empty update payload', async () => {
    await expect(service.update(createdDivision.id, {})).rejects.toThrow(
      new BadRequestException(DIVISION_UPDATE_EMPTY_MESSAGE),
    );
    expect(prisma.division.update).not.toHaveBeenCalled();
  });

  it('returns 404 when updating a missing or deleted division', async () => {
    prisma.division.findFirst.mockResolvedValue(null);

    await expect(
      service.update(createdDivision.id, { name: 'Updated Cardiology' }),
    ).rejects.toThrow(new NotFoundException(DIVISION_NOT_FOUND_MESSAGE));
    expect(prisma.division.update).not.toHaveBeenCalled();
  });

  it('returns 409 when update name already exists', async () => {
    prisma.division.findFirst
      .mockResolvedValueOnce(createdDivision)
      .mockResolvedValueOnce({
        ...createdDivision,
        id: '22222222-2222-2222-2222-222222222222',
      });

    await expect(
      service.update(createdDivision.id, { name: createDto.name }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.division.update).not.toHaveBeenCalled();
  });

  it('soft-deletes a division', async () => {
    prisma.category.count.mockResolvedValue(0);
    prisma.division.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.remove(createdDivision.id)).resolves.toBeUndefined();
    expect(prisma.category.count).toHaveBeenCalledWith({
      where: {
        divisionId: createdDivision.id,
        isDeleted: false,
      },
    });
    expect(prisma.division.updateMany).toHaveBeenCalledWith({
      where: {
        id: createdDivision.id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    });
  });

  it('returns 404 when deleting a missing or already deleted division', async () => {
    prisma.category.count.mockResolvedValue(0);
    prisma.division.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.remove(createdDivision.id)).rejects.toThrow(
      new NotFoundException(DIVISION_NOT_FOUND_MESSAGE),
    );
  });

  it('returns 409 when deleting a division that has categories', async () => {
    prisma.category.count.mockResolvedValue(2);

    await expect(service.remove(createdDivision.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.division.updateMany).not.toHaveBeenCalled();
  });
});
