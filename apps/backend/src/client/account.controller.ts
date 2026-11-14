import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Model } from 'mongoose';
import { InjectM } from '../database.module';
import { oid, paginate } from '../common/http';
import { ClientContext, CurrentClient } from './client.guard';

class VehicleDto {
  @IsString() @Length(1, 40) brand: string;
  @IsString() @Length(1, 60) model: string;
  @IsOptional() @IsInt() @Min(1950) @Max(2100) year?: number;
  @IsOptional() @IsString() @Length(0, 20) plate?: string;
}

@Controller()
export class ClientAccountController {
  constructor(
    @InjectM('Vehicle') private readonly vehicles: Model<any>,
    @InjectM('Notification') private readonly notifications: Model<any>,
  ) {}

  /* ---------- Véhicules (plusieurs par client) ---------- */

  @Get('vehicles')
  list(@CurrentClient() me: ClientContext) {
    return this.vehicles.find({ userId: me.id }).sort({ createdAt: 1 }).lean();
  }

  @Post('vehicles')
  create(@CurrentClient() me: ClientContext, @Body() dto: VehicleDto) {
    return this.vehicles.create({ ...dto, userId: oid(me.id) });
  }

  @Patch('vehicles/:id')
  async update(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: VehicleDto) {
    const v = await this.vehicles.findOneAndUpdate({ _id: oid(id), userId: oid(me.id) }, dto, { new: true }).lean();
    if (!v) throw new NotFoundException('Véhicule introuvable');
    return v;
  }

  @Delete('vehicles/:id')
  async remove(@CurrentClient() me: ClientContext, @Param('id') id: string) {
    const r = await this.vehicles.deleteOne({ _id: oid(id), userId: oid(me.id) });
    if (!r.deletedCount) throw new NotFoundException('Véhicule introuvable');
    return { ok: true };
  }

  /* ---------- Notifications ---------- */

  @Get('notifications')
  async listNotifications(@CurrentClient() me: ClientContext, @Query() q: Record<string, unknown>) {
    const filter = { recipientType: 'client', recipientId: oid(me.id) };
    const [page, unread] = await Promise.all([
      paginate(this.notifications, filter, q),
      this.notifications.countDocuments({ ...filter, readAt: null }),
    ]);
    return { ...page, unread };
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  async readAll(@CurrentClient() me: ClientContext) {
    await this.notifications.updateMany({ recipientType: 'client', recipientId: oid(me.id), readAt: null }, { readAt: new Date() });
    return { ok: true };
  }
}
