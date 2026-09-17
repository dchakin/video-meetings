import { NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GetAvatarFileHandler } from './get-avatar-file.handler';
import { GetAvatarFileQuery } from './get-avatar-file.query';

describe('GetAvatarFileHandler', () => {
  const fileName = '3f2b8c1e-4d5a-4b6c-8e7f-9a0b1c2d3e4f.png';
  let storageDir: string;
  let handler: GetAvatarFileHandler;

  beforeEach(async () => {
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avatars-'));
    process.env.AVATAR_STORAGE_DIR = storageDir;
    handler = new GetAvatarFileHandler();
  });

  afterEach(async () => {
    delete process.env.AVATAR_STORAGE_DIR;
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('возвращает путь и mimetype существующего аватара', async () => {
    await fs.writeFile(path.join(storageDir, fileName), 'png-bytes');

    await expect(handler.execute(new GetAvatarFileQuery(fileName))).resolves.toEqual({
      storagePath: path.join(storageDir, fileName),
      mimeType: 'image/png',
    });
  });

  it('отсутствующий файл — 404', async () => {
    await expect(handler.execute(new GetAvatarFileQuery(fileName))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each(['../secret.png', 'avatar.png', '3f2b8c1e-4d5a-4b6c-8e7f-9a0b1c2d3e4f.html'])(
    'имя не в формате аватара (%s) — 404 без обращения к диску',
    async (name) => {
      const stat = jest.spyOn(fs, 'stat');

      await expect(handler.execute(new GetAvatarFileQuery(name))).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(stat).not.toHaveBeenCalled();
      stat.mockRestore();
    },
  );
});
