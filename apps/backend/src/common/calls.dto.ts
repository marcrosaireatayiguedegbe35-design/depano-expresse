import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class OfferDto { @IsString() @MaxLength(20000) offer: string; }
export class AnswerDto { @IsString() @MaxLength(20000) answer: string; }
export class CandidatesDto { @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(2000, { each: true }) candidates: string[]; }
export class EndDto { @IsOptional() @IsIn(['decline', 'hangup']) reason?: string; }
