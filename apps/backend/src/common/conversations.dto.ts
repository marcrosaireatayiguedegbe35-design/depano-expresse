import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class StartConversationDto {
  @IsMongoId() professionalId: string;
  @IsString() @Length(3, 120) topic: string;
  @IsString() @Length(2, 1000) text: string;
}
export class MessageDto { @IsString() @Length(1, 1000) text: string; }
export class RespondConversationDto { @IsOptional() @IsString() @Length(0, 1000) text?: string; }
