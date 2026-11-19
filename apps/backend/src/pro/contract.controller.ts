import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import { Equals, IsIn, IsISO8601, IsString, Length, Matches } from 'class-validator';
import type { Response } from 'express';
import { Client, ClientInfo } from '../common/http';
import { CONTRACT_VERSION, ID_KINDS } from '../common/contract';
import { ProContractService } from '../common/pro-contract.service';
import { CurrentPro, ProContext } from './pro.guard';

const KINDS = Object.keys(ID_KINDS);
const ID_NUMBER = /^[A-Za-z0-9][A-Za-z0-9 \-/]{3,29}$/;

class PreviewDto {
  @IsIn(KINDS) idKind: string;
  @IsString() @Matches(ID_NUMBER, { message: 'Numéro de pièce invalide' }) idNumber: string;
}

class SignDto extends PreviewDto {
  @IsISO8601() issuedAt: string;
  @IsString() @Length(64, 64) textHash: string;
  /** Signature tracée au doigt : image PNG (data URL), 150 Ko maximum. */
  @IsString() @Length(200, 150_000) @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, { message: 'Signature invalide' }) signature: string;
  @Equals(true, { message: 'Vous devez accepter le contrat pour le signer' }) accept: boolean;
}

/** Contrat de partenariat : lecture personnalisée, signature au doigt, téléchargement du PDF signé. */
@Controller('contract')
export class ProContractController {
  constructor(private readonly contracts: ProContractService) {}

  /** État : contrat signé (version en vigueur ?) et pièce d'identité déjà déclarée. */
  @Get()
  async status(@CurrentPro() me: ProContext) {
    return { contract: await this.contracts.signedDetail(me.id), contractVersion: CONTRACT_VERSION, idKinds: ID_KINDS };
  }

  @Get('preview')
  preview(@CurrentPro() me: ProContext, @Query() q: PreviewDto) {
    return this.contracts.preview(me.id, q.idKind, q.idNumber);
  }

  @Post('sign')
  @HttpCode(200)
  sign(@CurrentPro() me: ProContext, @Body() dto: SignDto, @Client() client: ClientInfo) {
    // Une signature vide (cadre blanc) pèse très peu : on exige un tracé réel.
    if (dto.signature.length < 1500) throw new BadRequestException('Tracez votre signature dans le cadre avant de valider.');
    return this.contracts.sign(me.id, dto, client);
  }

  @Get('pdf')
  async pdf(@CurrentPro() me: ProContext, @Res() res: Response) {
    const { bytes, filename } = await this.contracts.pdf(me.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(Buffer.from(bytes));
  }
}
