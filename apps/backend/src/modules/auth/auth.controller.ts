import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Response } from 'express';
import {
  AdminContext, AllowPendingPassword, AuthOnly, Client, ClientInfo, CurrentAdmin, oid, Public,
} from '../../common/http';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @Length(1, 200) password: string;
}

class TicketCodeDto {
  @IsString() @Length(20, 100) ticket: string;
  @IsString() @Length(6, 6) code: string;
}

class TicketDto {
  @IsString() @Length(20, 100) ticket: string;
}

class DeleteSelfDto {
  @IsString() @Length(1, 128) password: string;
}

class ChangePasswordDto {
  @IsString() @Length(1, 200) currentPassword: string;
  @IsString() @Length(12, 128) newPassword: string;
  @IsOptional() @IsString() @Length(0, 6) code?: string;
}

const STRICT = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle(STRICT)
  login(@Body() dto: LoginDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto.email, dto.password, client, res);
  }

  @Post('2fa/verify')
  @Public()
  @HttpCode(200)
  @Throttle(STRICT)
  verify(@Body() dto: TicketCodeDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyMfa(dto.ticket, dto.code, client, res);
  }

  @Post('2fa/enroll')
  @Public()
  @HttpCode(200)
  @Throttle(STRICT)
  enroll(@Body() dto: TicketCodeDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    return this.auth.enroll(dto.ticket, dto.code, client, res);
  }

  @Post('2fa/resend')
  @Public()
  @HttpCode(200)
  @Throttle(STRICT)
  resend(@Body() dto: TicketDto) {
    return this.auth.resendMfa(dto.ticket);
  }

  @Post('code')
  @AuthOnly()
  @AllowPendingPassword()
  @HttpCode(200)
  @Throttle(STRICT)
  sendCode(@CurrentAdmin() admin: AdminContext) {
    return this.auth.sendActionCode(admin);
  }

  @Get('me')
  @AuthOnly()
  @AllowPendingPassword()
  me(@CurrentAdmin() admin: AdminContext) {
    return this.auth.me(admin);
  }

  @Post('logout')
  @AuthOnly()
  @AllowPendingPassword()
  @HttpCode(200)
  logout(@CurrentAdmin() admin: AdminContext, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(admin, client, res);
  }

  @Delete('me')
  @AuthOnly()
  @AllowPendingPassword()
  @Throttle(STRICT)
  deleteSelf(@CurrentAdmin() admin: AdminContext, @Body() dto: DeleteSelfDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    return this.auth.deleteSelf(admin, dto.password, client, res);
  }

  @Post('password')
  @AuthOnly()
  @AllowPendingPassword()
  @HttpCode(200)
  @Throttle(STRICT)
  changePassword(@CurrentAdmin() admin: AdminContext, @Body() dto: ChangePasswordDto, @Client() client: ClientInfo) {
    return this.auth.changePassword(admin, dto.currentPassword, dto.newPassword, dto.code ?? '', client);
  }

  @Get('sessions')
  @AuthOnly()
  sessions(@CurrentAdmin() admin: AdminContext) {
    return this.auth.listSessions(admin);
  }

  @Delete('sessions/:id')
  @AuthOnly()
  revoke(@CurrentAdmin() admin: AdminContext, @Param('id') id: string) {
    return this.auth.revokeSession(admin, String(oid(id)));
  }
}
