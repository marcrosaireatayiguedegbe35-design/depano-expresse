import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { AdminContext, Audit, CurrentAdmin, oid, oneOf, paginate, Perm, searchFilter } from '../../common/http';

export class ReasonDto {
  @IsString() @Length(3, 500) reason: string;
}

@Controller('users')
export class UsersController {
  constructor(
    @InjectM('User') private readonly users: Model<any>,
    @InjectM('Vehicle') private readonly vehicles: Model<any>,
    @InjectM('Intervention') private readonly interventions: Model<any>,
    @InjectM('Order') private readonly orders: Model<any>,
    @InjectM('Report') private readonly reports: Model<any>,
  ) {}

  @Get()
  @Perm('users.read')
  list(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = searchFilter(q.q, ['firstName', 'lastName', 'email', 'phone']);
    const status = oneOf(q.status, ['active', 'suspended'] as const);
    if (status) filter.status = status;
    return paginate(this.users, filter, q);
  }

  @Get(':id')
  @Perm('users.read')
  async get(@Param('id') id: string) {
    const _id = oid(id);
    const user = await this.users.findById(_id).lean();
    if (!user) throw new NotFoundException('Client introuvable');
    const [vehicles, interventions, orders, reports] = await Promise.all([
      this.vehicles.find({ userId: _id }).lean(),
      this.interventions.find({ clientId: _id }).sort({ createdAt: -1 }).limit(20).populate('professionalId', 'firstName lastName businessName trade').lean(),
      this.orders.find({ clientId: _id }).sort({ createdAt: -1 }).limit(20).lean(),
      this.reports.find({ targetType: 'user', targetId: _id }).sort({ createdAt: -1 }).lean(),
    ]);
    return { user, vehicles, interventions, orders, reports };
  }

  @Post(':id/suspend')
  @Perm('users.write')
  @Audit('users.suspend')
  async suspend(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Body() dto: ReasonDto) {
    const r = await this.users.updateOne(
      { _id: oid(id) },
      { status: 'suspended', suspension: { reason: dto.reason, at: new Date(), by: me.id } },
    );
    if (!r.matchedCount) throw new NotFoundException('Client introuvable');
    return { ok: true };
  }

  @Post(':id/reactivate')
  @Perm('users.write')
  @Audit('users.reactivate')
  async reactivate(@Param('id') id: string) {
    const r = await this.users.updateOne({ _id: oid(id) }, { status: 'active', $unset: { suspension: 1 } });
    if (!r.matchedCount) throw new NotFoundException('Client introuvable');
    return { ok: true };
  }
}
