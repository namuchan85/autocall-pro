import { IsArray, IsOptional } from 'class-validator';

export class ImportLiteDataDto {
  @IsOptional()
  @IsArray()
  customers?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsArray()
  calls?: Array<Record<string, unknown>>;
}
