import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from './common/http';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @Public()
  health() {
    return { status: 'ok', database: this.connection.readyState === 1 ? 'connected' : 'disconnected' };
  }
}
