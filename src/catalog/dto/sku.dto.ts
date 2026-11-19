import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSkuDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** e.g. `piece`, `g`, `ml`, `pack` — see docs/SCHEMA.md §1 */
  @IsString()
  baseUnit!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  costCents?: number;
}

export class UpdateSkuDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  costCents?: number;
}
