import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { InjectM } from '../../database.module';
import { temporaryPassword } from '../../common/crypto';
import { AdminContext, Audit, CurrentAdmin, oid, paginate, Perm, searchFilter } from '../../common/http';
import { PERMISSIONS, ROLE_KEYS, ROLES, RoleKey } from '../../common/permissions';

class CreateAdminDto {
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @Length(2, 100) name: string;
  @IsIn(ROLE_KEYS) role: RoleKey;
}

class UpdateAdminDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsIn(ROLE_KEYS) role?: RoleKey;
  @IsOptional() @IsIn(['active', 'suspended']) status?: 'active' | 'suspended';
}

const PROTECTED_ROLES: RoleKey[] = ['super_admin'];

@Controller('admins')
export class AdminsController {
  constructor(
    @InjectM('Administrator') private readonly admins: Model<any>,
    @InjectM('AdminSession') private readonly sessions: Model<any>,
  ) {}

  @Get('roles')
  @Perm('admins.read')
  roles() {
    return {
      roles: ROLE_KEYS.map((k) => ({ key: k, label: ROLES[k].label, permissions: ROLES[k].permissions })),
      permissions: Object.entries(PERMISSIONS).map(([key, label]) => ({ key, label })),
    };
  }

  @Get()
  @Perm('admins.read')
  list(@Query() q: Record<string, unknown>) {
    return paginate(this.admins, searchFilter(q.q, ['email', 'name']), q, { sort: { createdAt: 1 } });
  }

  @Post()
  @Perm('admins.write')
  @Audit('admins.create')
  async create(@CurrentAdmin() me: AdminContext, @Body() dto: CreateAdminDto) {
    this.assertCanAssign(me, dto.role);
    if (await this.admins.exists({ email: dto.email.toLowerCase() })) throw new BadRequestException('Cet e-mail est déjà utilisé');
    const password = temporaryPassword();
    const admin = await this.admins.create({
      email: dto.email, name: dto.name, role: dto.role, passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true, createdBy: me.id,
    });
    // Le mot de passe temporaire n'est affiché qu'une seule fois.
    return { id: admin._id, email: admin.email, temporaryPassword: password };
  }

  @Patch(':id')
  @Perm('admins.write')
  @Audit('admins.update')
  async update(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Body() dto: UpdateAdminDto) {
    const target = await this.loadTarget(me, id);
    if (dto.role) this.assertCanAssign(me, dto.role);
    if (me.id === id && (dto.role || dto.status)) throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle ou statut');
    if (target.role === 'super_admin' && (dto.status === 'suspended' || (dto.role && dto.role !== 'super_admin'))) {
      await this.assertNotLastSuperAdmin(id);
    }
    Object.assign(target, dto);
    await target.save();
    if (dto.status === 'suspended' || dto.role) await this.revokeAll(id);
    return { ok: true };
  }

  @Post(':id/reset-2fa')
  @Perm('admins.write')
  @Audit('admins.reset_2fa')
  async reset2fa(@CurrentAdmin() me: AdminContext, @Param('id') id: string) {
    if (me.id === id) throw new ForbiddenException('Action impossible sur votre propre compte');
    const target = await this.loadTarget(me, id);
    target.totpEnabled = false;
    target.totpSecretEnc = undefined;
    await target.save();
    await this.revokeAll(id);
    return { ok: true };
  }

  @Post(':id/reset-password')
  @Perm('admins.write')
  @Audit('admins.reset_password')
  async resetPassword(@CurrentAdmin() me: AdminContext, @Param('id') id: string) {
    if (me.id === id) throw new ForbiddenException('Utilisez « Changer mon mot de passe »');
    const target = await this.loadTarget(me, id);
    const password = temporaryPassword();
    target.passwordHash = await bcrypt.hash(password, 12);
    target.mustChangePassword = true;
    target.failedAttempts = 0;
    target.lockedUntil = undefined;
    await target.save();
    await this.revokeAll(id);
    return { temporaryPassword: password };
  }

  @Post(':id/revoke-sessions')
  @Perm('admins.write')
  @Audit('admins.revoke_sessions')
  async revokeSessions(@CurrentAdmin() me: AdminContext, @Param('id') id: string) {
    await this.loadTarget(me, id);
    const n = await this.revokeAll(id);
    return { revoked: n };
  }

  /* ---------- règles ---------- */

  private assertCanAssign(me: AdminContext, role: RoleKey) {
    if (PROTECTED_ROLES.includes(role) && me.role !== 'super_admin') {
      throw new ForbiddenException('Seul un super administrateur peut attribuer ce rôle');
    }
  }

  private async loadTarget(me: AdminContext, id: string) {
    const target = await this.admins.findById(oid(id)).select('+passwordHash +totpSecretEnc');
    if (!target) throw new BadRequestException('Administrateur introuvable');
    if (PROTECTED_ROLES.includes(target.role) && me.role !== 'super_admin') {
      throw new ForbiddenException('Seul un super administrateur peut modifier ce compte');
    }
    return target;
  }

  private async assertNotLastSuperAdmin(id: string) {
    const others = await this.admins.countDocuments({ role: 'super_admin', status: 'active', _id: { $ne: oid(id) } });
    if (others === 0) throw new ForbiddenException('Impossible : il doit rester au moins un super administrateur actif');
  }

  private async revokeAll(adminId: string) {
    const r = await this.sessions.updateMany({ adminId: oid(adminId), revokedAt: null }, { revokedAt: new Date() });
    return r.modifiedCount;
  }
}
