import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import type { MultipartFile } from '@fastify/multipart';
import { ActivityLogService, ActorInfo, deriveActorType, RequestInfo } from '../../common/activity-log/activity-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PROFILE_SELECT = {
  id: true,
  email: true,
  phone: true,
  name: true,
  preferredName: true,
  avatarUrl: true,
  wellnessPreferences: true,
  tier: true,
} as const;

const AVATARS_DIR = join(process.cwd(), 'uploads', 'avatars');

// Server-picked extension by sniffed mimetype, never the client-supplied
// filename — avoids both path traversal and serving a mislabeled file type.
const ALLOWED_AVATAR_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// FR-12: Profile Management self-service. Email/phone/DOB/gender aren't
// editable here — those either need a verified-change flow (email/phone,
// not built yet) or aren't part of this feature's scope.
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(actor: ActorInfo, dto: UpdateProfileDto, context: RequestInfo = {}) {
    const userId = actor.userId;
    if (dto.avatarUrl === '') {
      const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
      await this.deleteLocalAvatarFile(current?.avatarUrl);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto, avatarUrl: dto.avatarUrl === '' ? null : dto.avatarUrl },
    });
    await this.activityLog.record({
      actorUserId: actor.userId,
      actorRole: actor.role as UserRole,
      actorType: deriveActorType(actor.role),
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
      description: 'Updated profile details',
      ...context,
    });
    return this.getProfile(userId);
  }

  async setAvatarFromUpload(userId: string, file: MultipartFile | undefined) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = ALLOWED_AVATAR_TYPES[file.mimetype];
    if (!ext) throw new BadRequestException('Unsupported image type — use JPEG, PNG, WEBP, or GIF');

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      // @fastify/multipart rejects once the stream exceeds the registered
      // fileSize limit (see main.ts) — surface that as a normal 400 rather
      // than an unhandled 500.
      throw new BadRequestException('Image is too large (max 5MB)');
    }

    const filename = `${userId}-${randomUUID()}${ext}`;
    await writeFile(join(AVATARS_DIR, filename), buffer);

    const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    await this.deleteLocalAvatarFile(current?.avatarUrl);

    const avatarUrl = `${this.config.get<string>('publicUrl')}/uploads/avatars/${filename}`;
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    return this.getProfile(userId);
  }

  // Best-effort cleanup so switching/removing an avatar doesn't leak files
  // on disk. No-ops for avatars set via the raw PATCH path (an external URL,
  // not one of ours) — nothing local to delete in that case. The filename
  // must match our own generated pattern before we touch the filesystem —
  // avatarUrl can otherwise be set by the user themselves via PATCH, and
  // without this a crafted "…/uploads/avatars/../../etc/passwd"-style value
  // would turn this into an arbitrary-file-delete.
  private async deleteLocalAvatarFile(avatarUrl?: string | null) {
    if (!avatarUrl) return;
    const prefix = `${this.config.get<string>('publicUrl')}/uploads/avatars/`;
    if (!avatarUrl.startsWith(prefix)) return;
    const filename = avatarUrl.slice(prefix.length);
    if (!/^[\w-]+\.(jpg|png|webp|gif)$/.test(filename)) return;
    const filePath = join(AVATARS_DIR, filename);
    if (existsSync(filePath)) await unlink(filePath).catch(() => {});
  }
}
