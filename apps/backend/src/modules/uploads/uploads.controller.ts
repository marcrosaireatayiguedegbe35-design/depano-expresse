import { Body, Controller, HttpCode, Post, ServiceUnavailableException } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { createHash } from 'crypto';
import { AuthOnly } from '../../common/http';

class SignatureDto {
  @IsIn(['products', 'companies', 'advertisements', 'categories', 'site']) folder: string;
}

/**
 * Envoi d'images vers Cloudinary : le navigateur envoie le fichier directement à
 * Cloudinary avec une signature courte générée ici. Le secret API ne quitte jamais le serveur.
 */
@Controller('uploads')
export class UploadsController {
  @Post('signature')
  @AuthOnly()
  @HttpCode(200)
  sign(@Body() dto: SignatureDto) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !secret) throw new ServiceUnavailableException('Cloudinary non configuré');

    const params: Record<string, string> = {
      folder: `plateforme-auto/${dto.folder}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
    const signature = createHash('sha1').update(toSign + secret).digest('hex');
    return {
      ...params,
      signature,
      apiKey,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }
}
